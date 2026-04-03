## Backend — Bulk Voucher Generation

### Schema first

Add this before writing a single line of backend code:

```prisma
enum BulkJobStatus {
  PENDING
  PROCESSING
  DONE
  PARTIAL_FAILURE
  FAILED
}

model bulk_voucher_jobs {
  id              Int            @id @default(autoincrement())
  created_by      String
  campus_id       Int
  class_id        Int?
  section_id      Int?
  academic_year   String         @db.VarChar(10)
  fee_date_from   DateTime       @db.Date
  fee_date_to     DateTime       @db.Date
  issue_date      DateTime       @db.Date
  due_date        DateTime       @db.Date
  validity_date   DateTime?      @db.Date
  bank_account_id Int
  late_fee_charge Boolean        @default(false)
  late_fee_amount Decimal?       @db.Decimal(10, 2)
  show_discount   Boolean        @default(true)
  status          BulkJobStatus  @default(PENDING)
  total_count     Int            @default(0)
  success_count   Int            @default(0)
  skip_count      Int            @default(0)
  fail_count      Int            @default(0)
  merged_pdf_url  String?
  confirmed_ccs   Int[]
  created_at      DateTime       @default(now()) @db.Timestamp(6)
  updated_at      DateTime       @updatedAt

  users           users          @relation(fields: [created_by], references: [id])
  campuses        campuses       @relation(fields: [campus_id], references: [id])
  bank_accounts   bank_accounts  @relation(fields: [bank_account_id], references: [id])
}
```

`confirmed_ccs` is a Postgres integer array — stores the exact list of student CCs the admin confirmed in the preview step. The job processes exactly this list, nothing else.

---

### Module structure

This lives in `features/finance/bulk-voucher/` as its own NestJS module. Do not bolt this onto the existing vouchers service — it has different concerns and will grow independently.

```
features/finance/bulk-voucher/
  bulk-voucher.module.ts
  bulk-voucher.controller.ts
  bulk-voucher.service.ts
  bulk-voucher-processor.service.ts   ← the actual job runner
  bulk-voucher-pdf.service.ts         ← handles merge
  dto/
    create-bulk-job.dto.ts
    preview-bulk-job.dto.ts
  types/
    bulk-job-result.types.ts
```

---

### Endpoints

**GET `/v1/bulk-voucher/preview`**

Query params: `campus_id`, `class_id?`, `section_id?`, `academic_year`, `fee_date_from`, `fee_date_to`.

What it does: resolves the student scope, then for each student checks whether they have any `student_fees` rows where `fee_date` falls in the range and `status = NOT_ISSUED`. Returns three buckets — will generate, will skip (already has voucher in range), will skip (no fee heads in range). Also returns the total estimated PKR amount across all will-generate students.

This endpoint must be fast — it's called every time a filter changes. No PDF work, no heavy joins. Just student resolution + fee head counts.

```typescript
// Response shape
{
  will_generate: [{ cc: number, full_name: string, gr_number: string, fee_count: number, total_amount: number }],
  skip_voucher_exists: [{ cc: number, full_name: string }],
  skip_no_heads: [{ cc: number, full_name: string }],
  summary: {
    total_in_scope: number,
    will_generate: number,
    will_skip: number,
    estimated_total_pkr: number
  }
}
```

---

**POST `/v1/bulk-voucher/jobs`**

Creates the job record and enqueues it. Returns immediately with the job ID.

```typescript
// Request body
{
  campus_id: number,
  class_id?: number,
  section_id?: number,
  academic_year: string,
  fee_date_from: string,
  fee_date_to: string,
  issue_date: string,
  due_date: string,
  validity_date?: string,
  bank_account_id: number,
  late_fee_charge: boolean,
  late_fee_amount?: number,
  show_discount: boolean,
  confirmed_ccs: number[]   // exact list from preview
}

// Response
{ job_id: number }
```

Controller validates the DTO, creates the `bulk_voucher_jobs` row with status `PENDING`, then fires the processor asynchronously. Do not await the processor in the controller — return the job_id immediately.

```typescript
// In controller
const job = await this.bulkVoucherService.createJob(dto, req.user.id);
this.bulkVoucherProcessorService.process(job.id); // fire and forget
return { job_id: job.id };
```

---

**GET `/v1/bulk-voucher/jobs/:id`**

Returns current job state. Frontend polls this every 2 seconds.

```typescript
{
  id: number,
  status: BulkJobStatus,
  total_count: number,
  success_count: number,
  skip_count: number,
  fail_count: number,
  merged_pdf_url: string | null,
  failures: [{ cc: number, full_name: string, reason: string }],
  created_at: string,
  updated_at: string
}
```

`failures` is a separate table or a JSONB column on the job — you need to store per-student failure reasons so the admin knows who to fix manually. Add a `failures` JSONB column to `bulk_voucher_jobs` for this.

---

**GET `/v1/bulk-voucher/jobs`**

Lists recent jobs for the current user's campus. Useful for showing job history and re-downloading merged PDFs. Paginated, newest first. Filter by status and academic year.

---

### The processor service

This is the core. It runs asynchronously after the job is created.

```typescript
async process(jobId: number): Promise<void> {
  const job = await this.getJob(jobId);
  await this.updateJobStatus(jobId, 'PROCESSING');

  const pdfUrls: string[] = [];
  const failures: FailureRecord[] = [];

  for (const cc of job.confirmed_ccs) {
    try {
      const result = await this.processStudent(cc, job);
      if (result.skipped) {
        await this.incrementSkip(jobId);
      } else {
        pdfUrls.push(result.pdf_url);
        await this.incrementSuccess(jobId);
      }
    } catch (err) {
      failures.push({ cc, reason: err.message });
      await this.incrementFail(jobId);
    }
  }

  // After all students done, merge PDFs
  if (pdfUrls.length > 0) {
    const mergedUrl = await this.bulkVoucherPdfService.merge(pdfUrls, jobId);
    await this.setMergedPdfUrl(jobId, mergedUrl);
  }

  const finalStatus = failures.length > 0 ? 'PARTIAL_FAILURE' : 'DONE';
  await this.finalizeJob(jobId, finalStatus, failures);
}
```

**`processStudent` — what it does per student:**

1. Fetch `student_fees` rows for this CC where `fee_date` between `fee_date_from` and `fee_date_to` and `academic_year` matches and `status = NOT_ISSUED`.
2. If none found, mark as skipped (no heads). Do not create a voucher.
3. Check if a voucher already exists for this student in this `fee_date` range. If yes and "skip already issued" is on, mark as skipped.
4. Group fee heads by `fee_date` — same grouping logic as the single-student challan generator.
5. For each `fee_date` group, generate the PDF using the existing `FeeChallanPDF` component (or its server-side equivalent). Upload to S3. Get the URL.
6. Create the `vouchers` row. Create `voucher_heads` rows. Update `student_fees.status` to `ISSUED` for each head included.
7. Return the `pdf_url`.

Each student's DB operations run in a Prisma transaction. One student failing does not affect others.

**Increment functions must be atomic.** Use Prisma's `update` with increment to avoid race conditions:

```typescript
await this.prisma.bulk_voucher_jobs.update({
  where: { id: jobId },
  data: { success_count: { increment: 1 } }
});
```

---

### PDF merge service

```typescript
async merge(pdfUrls: string[], jobId: number): Promise<string> {
  const { PDFDocument } = await import('pdf-lib');
  const merged = await PDFDocument.create();

  // Sort URLs by class → section → name order
  // (urls should come in sorted from the processor)

  for (const url of pdfUrls) {
    const bytes = await this.s3Service.downloadAsBuffer(url);
    const doc = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach(p => merged.addPage(p));
  }

  const mergedBytes = await merged.save();
  const key = `bulk-vouchers/job-${jobId}-merged.pdf`;
  const mergedUrl = await this.s3Service.upload(key, mergedBytes, 'application/pdf');
  return mergedUrl;
}
```

Sort the `pdfUrls` array before passing it to merge — class ASC, section ASC, student name ASC. The processor needs to carry this metadata alongside each URL so the merge service can sort correctly.

For large batches (300+ students) this will hold a lot of buffers in memory simultaneously. If memory becomes a concern later, switch to streaming merge using `hummus` or `pdfmake` — but pdf-lib is fine to start with.

Use a **signed S3 URL with 24-hour expiry** for the merged PDF. It's a bulk print artifact, not a permanent record. Individual student `pdf_url` values in `vouchers` are permanent — the merged file is not.

---

### Student scope resolution

Extract this into a shared utility used by both preview and the processor:

```typescript
async resolveScope(
  campusId: number,
  classId?: number,
  sectionId?: number,
  academicYear?: string
): Promise<number[]> {
  return this.prisma.students.findMany({
    where: {
      campus_id: campusId,
      ...(classId && { class_id: classId }),
      ...(sectionId && { section_id: sectionId }),
      status: 'ENROLLED',
      deleted_at: null
    },
    select: { cc: true }
  }).then(rows => rows.map(r => r.cc));
}
```

Only `ENROLLED` students. Never `SOFT_ADMISSION`, `EXPELLED`, or `GRADUATED`. This is implicit but must be explicit in code — a bulk generation accidentally hitting a SOFT_ADMISSION student will create vouchers for a student who isn't even confirmed yet.

### Error handling rules

- Student has no fee heads in range → `skipped`, not a failure. Don't increment `fail_count`.
- Student already has a voucher in range and skip toggle is on → `skipped`, not a failure.
- S3 upload fails for a student → `failure`. Log the reason. Continue to next student.
- PDF generation throws → `failure`. Log the reason. Continue.
- Prisma transaction fails for a student → `failure`. The transaction rolls back only that student's records. Continue.
- If `fail_count` reaches `total_count` (every single student failed) → set job status to `FAILED`, not `PARTIAL_FAILURE`. This distinction matters for the frontend — `FAILED` means nothing was generated, `PARTIAL_FAILURE` means some were.
- Merge step fails → log it, set `merged_pdf_url` to null, still mark job as `DONE` or `PARTIAL_FAILURE` based on individual results. The individual vouchers are already saved — the merge failing is not a reason to mark everything as failed. Surface a separate warning on the frontend: "Individual vouchers generated successfully. Merged PDF unavailable — retry merge."

Add a **`POST /v1/bulk-voucher/jobs/:id/retry-merge`** endpoint for exactly this case. It re-fetches all successful voucher `pdf_url` values for the job and re-runs the merge. No re-generation of individual vouchers.