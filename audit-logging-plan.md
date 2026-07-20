# System-Wide Audit Logging — Phase 1 (Approvals, Rejections, High-Stakes Changes)

## Context

The app already has a working audit-log system (`audit_logs` table + `AuditLogsService` + the "Activity Logs" page), but it was wired up piecemeal — roughly half the modules call it, half don't. The user wants every approve/reject/change action across the app to show up in the log, starting with the highest-stakes workflows: HR leave approvals, attendance objection reviews, payroll finalize/disburse/delete, support ticket approve/reject/claim/transfer/close, and student promotion/graduation/expulsion. Lower-stakes CRUD-only modules (HR policies, calendar, saturday schedules, timetables, discount presets, installments, enrollments, backups) are explicitly deferred to a Phase 2. Chat is excluded entirely.

Because logging in this codebase is 100% manual (no interceptor/decorator/signal exists), Phase 1 is a series of targeted edits: import `AuditLogsService` into each gap service and call `.log(...)` at the point of mutation, following the existing pattern already used successfully in `parent-change-requests.service.ts`.

## Existing infrastructure (reuse, don't rebuild)

- **Table**: `audit_logs` (`tafs-backend/prisma/schema.prisma:1525`) — row-per-field-change, with `entity_type`, `entity_id`, `action`, `field`, `old_value`, `new_value`, `changed_by`, `student_id?`, `section`, `note?`.
- **Writer**: `AuditLogsService.log(params)` (`tafs-backend/src/modules/audit-logs/audit-logs.service.ts:29`) — fire-and-forget, injectable anywhere (module is `@Global()`). Auto-derives `section` from `entity_type` via the `SECTION_ENTITY_TYPES` map at the top of that file (lines 6-15).
- **Reader**: `GET /audit-logs` (`audit-logs.controller.ts`), filtered by role via `AuditLogsGuard` (SUPER_ADMIN/CAMPUS_ADMIN/PRINCIPAL only).
- **Frontend**: `app/(dashboard)/system/logs/page.tsx` — section tabs are hardcoded as `BASE_SECTIONS` (line 43: `student, finance, communication, hr, attendance, school-setup, system` + `parent-requests` for super admins). `entity_type` is displayed dynamically (`log.entity_type.replace(/_/g, " ")`, line 221) — **no frontend enum to update**, since new entity types render automatically.
- **Reference pattern to copy**: `parent-change-requests.service.ts:271-295` (`processRequest`) — diffs old vs. new, logs one row per changed field with a shared `note` giving context, uses `changed_by: user.username` (resolved in the controller, `parent-change-requests.controller.ts:47`: `req.user?.username || req.user?.sub || 'system'`).

## Standardization rules to apply everywhere in this pass

1. **`changed_by`**: always `user.username` (fallback to `user.sub`), matching the existing convention — no full-name lookup exists in the JWT payload, don't invent one.
2. **`action` vocabulary**: fixed past-tense strings, not raw DTO passthrough — `APPROVED`, `REJECTED`, `REVOKED`, `FINALIZED`, `DELETED`, `DISBURSED`, `CLAIMED`, `TRANSFERRED`, `FORWARDED`, `CLOSED`, `REPLY_APPROVED`, `REPLY_REJECTED`, `PROMOTED`, `GRADUATED`, `EXPELLED`.
3. **No new sections needed** — every Phase 1 entity type slots into an existing section (`hr`, `attendance`, `communication`, `student`). Only `SECTION_ENTITY_TYPES` in `audit-logs.service.ts` needs new entries.
4. **Fire-and-forget, after the mutation succeeds** — call `.log()` after the Prisma write commits (matches existing pattern), never block the response on it.

## Module-by-module work

### 1. HR Leave Requests — `tafs-backend/src/modules/hr/leaves/leave-requests.service.ts`
- Inject `AuditLogsService`.
- `review()` (line 183-240): after the `prisma.leave_requests.update` at line 210, log `entity_type: 'LEAVE_REQUEST'`, `entity_id: String(id)`, `action: dto.status` → normalize to `'APPROVED'`/`'REJECTED'`, `field: 'status'`, `old_value: 'PENDING'`, `new_value: dto.status`, `changed_by: user.username`, `note: dto.reviewReason ?? undefined`.
- `revoke()` (line 242-270): after the update at line 257, log `action: 'REVOKED'`, `old_value: 'APPROVED'`, `new_value: 'REJECTED'`, `note: reason`.
- Add `LEAVE_REQUEST` to the `hr` bucket in `SECTION_ENTITY_TYPES`.

### 2. Attendance Objections — `tafs-backend/src/modules/attendance/attendance-objections.service.ts`
- Inject `AuditLogsService`.
- `review()` (line 103-143): after the update at line 120, log `entity_type: 'ATTENDANCE_OBJECTION'`, `entity_id: String(id)`, `action: dto.status` normalized (`'ACCEPTED'`/`'REJECTED'`), `field: 'status'`, `old_value: 'PENDING'`, `new_value: dto.status`, `changed_by: user.username`, `note: dto.admin_notes ?? undefined`.
- Add `ATTENDANCE_OBJECTION` to the `attendance` bucket.

### 3. Payroll — `tafs-backend/src/modules/hr/payroll/payroll.service.ts`
- Inject `AuditLogsService`.
- `finalizeRun()` (line 651-673): after the update at line 668, log `entity_type: 'PAYROLL_RUN'`, `entity_id: String(id)`, `action: 'FINALIZED'`, `field: 'status'`, `old_value: run.status`, `new_value: 'FINALIZED'`, `changed_by: user.username`.
- `deleteRun()` (line 675-684): before/after the delete at line 682, log `action: 'DELETED'`, `note` with period/campus info (row is gone after delete, so capture what's needed from `run` first).
- `disburseLine()` (line 764-786): after update at line 777, log `action: 'DISBURSED'`, `entity_id: String(runId)`, `field: 'employee_id'`, `new_value: String(employeeId)`, `note: dto.notes ?? undefined`.
- `disburseAll()` (line 788-810): after `updateMany` at line 801, log one row, `action: 'DISBURSED_ALL'`, `note` with count/period.
- Add `PAYROLL_RUN` to the `hr` bucket.

### 4. Support Tickets — `tafs-backend/src/modules/support-tickets/support-tickets.service.ts`
- This module already has a `TicketEventType` enum and writes to `ticket_events` — reuse those exact action names for consistency instead of inventing new ones.
- Inject `AuditLogsService`; at every call site that currently writes a `ticket_events` row (per the explore findings: `reviewReply` ~line 656+ for `REPLY_APPROVED`/`REPLY_REJECTED`, plus claim/transfer/forward/close handlers), add a matching `AuditLogsService.log()` call with `entity_type: 'SUPPORT_TICKET'`, `entity_id: String(ticketId)`, `action` = the same `TicketEventType` value, `changed_by: user.username`.
- Add `SUPPORT_TICKET` to the `communication` bucket.

### 5. Student Promotion / Graduation / Expulsion — `tafs-backend/src/modules/students/students.service.ts`
- Already injects things via the module; add `AuditLogsService` if not present.
- At the same call sites that write to `student_academic_history` (`promoteSingle` ~line 1689, `promoteBulk`/`processPromotionForStudent` ~line 1709-1886), add a mirrored `AuditLogsService.log()` call: `entity_type: 'STUDENT'` (already an existing type, so it lands in the `student` section with no map change needed), `entity_id: String(cc)`, `action: 'PROMOTED'` / `'GRADUATED'` / `'EXPELLED'` (pick based on the transition), `field: 'class_id'` or similar, `old_value`/`new_value` from the same data already used for `student_academic_history`, `changed_by: user.username`, `student_id: cc`.

## Frontend

No changes required for Phase 1 — the Activity Logs page renders `entity_type` dynamically and the 4 sections touched (`hr`, `attendance`, `communication`, `student`) already exist as tabs. Verify visually after backend changes ship that new entity types appear correctly under their section tab and that `note`/`old_value`/`new_value` render sensibly (payroll and promotion notes are freeform text, not simple field diffs, so double check the timeline UI doesn't assume a field name is always present).

## Deferred to Phase 2 (not part of this implementation pass)

HR Policies, Academic Calendar, Saturday Schedules, Class Attendance Modes, Timetables, Discount Presets, Installments, Enrollments, Unconfirmed Admissions, Student Flags, Database Backups. Same pattern applies (inject `AuditLogsService`, log at mutation points) — revisit once Phase 1 is verified in production.

## Verification

1. `cd tafs-backend && npm run build` (or the project's typecheck script) to confirm no TS errors from the new imports/calls.
2. Manually exercise each Phase 1 workflow against a local/dev backend:
   - Approve and reject a leave request → check `/system/logs` under the `hr` tab.
   - Accept and reject an attendance objection → check `attendance` tab.
   - Finalize, disburse (single + all), and delete a payroll run → check `hr` tab, confirm disbursement notes show up.
   - Approve/reject a support ticket reply, claim/transfer/forward/close a ticket → check `communication` tab.
   - Promote a student (single and bulk) → check `student` tab, and confirm `student_academic_history` still gets written as before (dual-write, not a replacement).
3. Confirm `changed_by` shows the acting staff member's username in every new log row, and that timestamps/ordering look correct in the existing Logs UI (`system/logs` and, for student-scoped rows, `StudentLogsTab`).
