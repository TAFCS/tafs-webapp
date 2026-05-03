import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../lib/api';
import { getCurrentAcademicYear } from '../../lib/fee-utils';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface BulkFilters {
    campusId: string;
    classId: string;
    sectionId: string;
    dateFrom: string;
    dateTo: string;
    issueDate: string;
    dueDate: string;
    validityDate: string;
    bankAccountId: string;
    applyLateFee: boolean;
    lateFeeAmount: number;
    skipAlreadyIssued: boolean;
    waiveSurcharge: boolean;
    jobType?: 'BULK' | 'BATCH';
    student_ccs?: number[];
}

export interface BulkStudent {
    cc: number;
    student_full_name: string;
    gr_number: string;
    class_name: string;
    section_name: string;
    is_already_issued?: boolean;
}

export interface BulkVoucherState {
    currentStep: number;
    filters: BulkFilters;
    previewStudents: BulkStudent[];
    selectedStudentCCs: number[];
    isFetchingPreview: boolean;
    isGenerating: boolean;
    jobId: number | null;
    jobStatus: 'idle' | 'processing' | 'done' | 'failed';
    progress: number;
    totalCount: number;
    successCount: number;
    skipCount: number;
    failCount: number;
    mergedPdfUrl: string | null;
    history: any[];
    isFetchingHistory: boolean;
    error: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Async Thunks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Step 1 → Step 2: Calls POST /bulk-voucher-jobs/preview
 * Returns rich BulkStudent[] with is_already_issued flag.
 */
export const fetchBulkPreview = createAsyncThunk(
    'bulkVoucher/fetchPreview',
    async (filters: BulkFilters, { rejectWithValue }) => {
        try {
            const response = await api.post(
                '/v1/bulk-voucher-jobs/preview',
                {
                    campus_id: parseInt(filters.campusId),
                    class_id: filters.classId ? parseInt(filters.classId) : undefined,
                    section_id: filters.sectionId ? parseInt(filters.sectionId) : undefined,
                    fee_date_from: filters.dateFrom,
                    fee_date_to: filters.dateTo,
                    skip_already_issued: filters.skipAlreadyIssued,
                    student_ccs: filters.student_ccs,
                }
            );

            return response.data.data as BulkStudent[];
        } catch (err: any) {
            return rejectWithValue(
                err.response?.data?.message ?? err.message ?? 'Preview failed.',
            );
        }
    },
);

/**
 * Step 2 → Step 3: Calls POST /bulk-voucher-jobs
 * Sends the confirmed CC list. Returns { job_id } immediately.
 */
export const startBulkJob = createAsyncThunk(
    'bulkVoucher/startJob',
    async (
        { filters, studentCCs }: { filters: BulkFilters; studentCCs: number[] },
        { rejectWithValue },
    ) => {
        try {
            const response = await api.post(
                '/v1/bulk-voucher-jobs',
                {
                    campus_id: parseInt(filters.campusId),
                    class_id: filters.classId ? parseInt(filters.classId) : undefined,
                    section_id: filters.sectionId ? parseInt(filters.sectionId) : undefined,
                    fee_date_from: filters.dateFrom,
                    fee_date_to: filters.dateTo,
                    issue_date: filters.issueDate,
                    due_date: filters.dueDate,
                    validity_date: filters.validityDate || undefined,
                    bank_account_id: parseInt(filters.bankAccountId),
                    apply_late_fee: filters.applyLateFee,
                    late_fee_amount: filters.lateFeeAmount,
                    skip_already_issued: filters.skipAlreadyIssued,
                    waive_surcharge: filters.waiveSurcharge,
                    job_type: filters.jobType || 'BULK',
                    student_ccs: studentCCs,
                }
            );

            return response.data.data as { job_id: number };
        } catch (err: any) {
            return rejectWithValue(
                err.response?.data?.message ?? err.message ?? 'Failed to start job.',
            );
        }
    },
);

/**
 * Polling: Calls GET /bulk-voucher-jobs/:id/status
 * Returns current job counters + status + merged_pdf_url.
 */
export const pollJobStatus = createAsyncThunk(
    'bulkVoucher/pollStatus',
    async (jobId: number, { rejectWithValue }) => {
        try {
            const response = await api.get(`/v1/bulk-voucher-jobs/${jobId}/status`);

            return response.data.data as {
                status: string;
                total_count: number;
                success_count: number;
                skip_count: number;
                fail_count: number;
                merged_pdf_url: string | null;
            };
        } catch (err: any) {
            return rejectWithValue(
                err.response?.data?.message ?? err.message ?? 'Failed to poll job.',
            );
        }
    },
);

/**
 * Fetch bulk job history.
 */
export const fetchBulkHistory = createAsyncThunk(
    'bulkVoucher/fetchHistory',
    async (campusId: string | undefined, { rejectWithValue }) => {
        try {
            const response = await api.get('/v1/bulk-voucher-jobs', {
                params: { campus_id: campusId },
            });
            return response.data.data;
        } catch (err: any) {
            return rejectWithValue(
                err.response?.data?.message ?? err.message ?? 'History fetch failed.',
            );
        }
    },
);

/**
 * Validates a list of CCs and returns previews.
 */
export const validateCCs = createAsyncThunk(
    'bulkVoucher/validateCCs',
    async (
        { ccs, filters }: { ccs: number[]; filters: BulkFilters },
        { rejectWithValue },
    ) => {
        try {
            const response = await api.post(
                '/v1/bulk-voucher-jobs/preview',
                {
                    student_ccs: ccs,
                    fee_date_from: filters.dateFrom,
                    fee_date_to: filters.dateTo,
                    skip_already_issued: filters.skipAlreadyIssued,
                }
            );

            return response.data.data as BulkStudent[];
        } catch (err: any) {
            return rejectWithValue(
                err.response?.data?.message ?? err.message ?? 'Validation failed.',
            );
        }
    },
);

// ─────────────────────────────────────────────────────────────────────────────
// Initial State
// ─────────────────────────────────────────────────────────────────────────────

const initialState: BulkVoucherState = {
    currentStep: 1,
    filters: {
        campusId: '',
        classId: '',
        sectionId: '',
        dateFrom: new Date().toISOString().split('T')[0],
        dateTo: new Date().toISOString().split('T')[0],
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        validityDate: new Date().toISOString().split('T')[0],
        bankAccountId: '',
        applyLateFee: true,
        lateFeeAmount: 1000,
        skipAlreadyIssued: true,
        waiveSurcharge: false,
        jobType: 'BULK',
    },
    previewStudents: [],
    selectedStudentCCs: [],
    isFetchingPreview: false,
    isGenerating: false,
    jobId: null,
    jobStatus: 'idle',
    progress: 0,
    totalCount: 0,
    successCount: 0,
    skipCount: 0,
    failCount: 0,
    mergedPdfUrl: null,
    history: [],
    isFetchingHistory: false,
    error: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Slice
// ─────────────────────────────────────────────────────────────────────────────

const bulkVoucherSlice = createSlice({
    name: 'bulkVoucher',
    initialState,
    reducers: {
        setStep(state, action: PayloadAction<number>) {
            state.currentStep = action.payload;
        },
        updateFilters(state, action: PayloadAction<Partial<BulkFilters>>) {
            state.filters = { ...state.filters, ...action.payload };
        },
        setSelectedStudents(state, action: PayloadAction<number[]>) {
            state.selectedStudentCCs = action.payload;
        },
        resetBulkProcess(state) {
            state.currentStep = 1;
            state.jobStatus = 'idle';
            state.jobId = null;
            state.progress = 0;
            state.totalCount = 0;
            state.successCount = 0;
            state.skipCount = 0;
            state.failCount = 0;
            state.mergedPdfUrl = null;
            state.previewStudents = [];
            state.selectedStudentCCs = [];
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        // ── Preview ──────────────────────────────────────────────────────────
        builder
            .addCase(fetchBulkPreview.pending, (state) => {
                state.isFetchingPreview = true;
                state.error = null;
            })
            .addCase(fetchBulkPreview.fulfilled, (state, action) => {
                state.isFetchingPreview = false;
                state.previewStudents = action.payload;
                // Auto-select students that are not already issued (or all if toggle is off)
                state.selectedStudentCCs = action.payload
                    .filter((s) => !state.filters.skipAlreadyIssued || !s.is_already_issued)
                    .map((s) => s.cc);
            })
            .addCase(fetchBulkPreview.rejected, (state, action) => {
                state.isFetchingPreview = false;
                state.error = action.payload as string;
            })
            .addCase(validateCCs.pending, (state) => {
                state.isFetchingPreview = true;
                state.error = null;
            })
            .addCase(validateCCs.fulfilled, (state, action) => {
                state.isFetchingPreview = false;
                state.previewStudents = action.payload;
                state.selectedStudentCCs = action.payload.map((s) => s.cc);
            })
            .addCase(validateCCs.rejected, (state, action) => {
                state.isFetchingPreview = false;
                state.error = action.payload as string;
            });

        // ── Start Job ────────────────────────────────────────────────────────
        builder
            .addCase(startBulkJob.pending, (state) => {
                state.isGenerating = true;
                state.jobStatus = 'processing';
                state.error = null;
            })
            .addCase(startBulkJob.fulfilled, (state, action) => {
                state.isGenerating = false;
                state.jobId = action.payload.job_id;
            })
            .addCase(startBulkJob.rejected, (state, action) => {
                state.isGenerating = false;
                state.jobStatus = 'failed';
                state.error = action.payload as string;
            });

        // ── Poll Status ──────────────────────────────────────────────────────
        builder
            .addCase(pollJobStatus.fulfilled, (state, action) => {
                const { status, total_count, success_count, skip_count, fail_count, merged_pdf_url } =
                    action.payload;

                state.totalCount = total_count;
                state.successCount = success_count;
                state.skipCount = skip_count;
                state.failCount = fail_count;
                state.mergedPdfUrl = merged_pdf_url;

                const completed = success_count + skip_count + fail_count;
                state.progress = total_count > 0 ? Math.round((completed / total_count) * 100) : 0;

                if (status === 'DONE') {
                    state.jobStatus = 'done';
                    state.progress = 100;
                } else if (status === 'FAILED') {
                    state.jobStatus = 'failed';
                } else if (status === 'PARTIAL_FAILURE') {
                    state.jobStatus = 'done'; // treat partial as done so download appears
                } else {
                    state.jobStatus = 'processing';
                }
            })
            // ── History ────────────────────────────────────────────────────────
            .addCase(fetchBulkHistory.pending, (state) => {
                state.isFetchingHistory = true;
            })
            .addCase(fetchBulkHistory.fulfilled, (state, action) => {
                state.isFetchingHistory = false;
                state.history = action.payload;
            })
            .addCase(fetchBulkHistory.rejected, (state, action) => {
                state.isFetchingHistory = false;
                state.error = action.payload as string;
            });
    },
});

export const { setStep, updateFilters, setSelectedStudents, resetBulkProcess } =
    bulkVoucherSlice.actions;
export default bulkVoucherSlice.reducer;
