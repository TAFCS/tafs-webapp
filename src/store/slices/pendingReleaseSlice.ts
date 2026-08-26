import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../lib/api';
import type { VoucherItem } from './vouchersSlice';

export interface PendingReleaseFilters {
    campus_id?: string;
    class_id?: string;
    bulk_voucher_job_id?: number;
    cc?: number;
    gr?: string;
    page?: number;
    limit?: number;
}

export interface PendingReleasePagination {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

interface PendingReleaseState {
    items: VoucherItem[];
    isLoading: boolean;
    isReleasing: boolean;
    error: string | null;
    pagination: PendingReleasePagination;
}

const initialState: PendingReleaseState = {
    items: [],
    isLoading: false,
    isReleasing: false,
    error: null,
    pagination: { total: 0, page: 1, limit: 50, totalPages: 1 },
};

export const fetchPendingRelease = createAsyncThunk(
    'pendingRelease/fetchAll',
    async (filters: PendingReleaseFilters = {}, { rejectWithValue }) => {
        try {
            const params: Record<string, string | number> = {};
            if (filters.campus_id) params.campus_id = filters.campus_id;
            if (filters.class_id) params.class_id = filters.class_id;
            if (filters.bulk_voucher_job_id != null) params.bulk_voucher_job_id = filters.bulk_voucher_job_id;
            if (filters.cc) params.cc = filters.cc;
            if (filters.gr) params.gr = filters.gr;
            if (filters.page) params.page = filters.page;
            if (filters.limit) params.limit = filters.limit;

            const response = await api.get('/v1/vouchers/pending-release', { params });
            const data = response.data?.data;
            if (data && Array.isArray(data.items)) {
                return {
                    items: data.items as VoucherItem[],
                    pagination: data.meta || {
                        total: data.items.length,
                        page: 1,
                        limit: data.items.length,
                        totalPages: 1,
                    },
                };
            }
            return {
                items: [] as VoucherItem[],
                pagination: { total: 0, page: 1, limit: 50, totalPages: 1 },
            };
        } catch (err: any) {
            return rejectWithValue(
                err.response?.data?.message || 'Failed to fetch pending-release vouchers.',
            );
        }
    },
);

export const releaseVouchers = createAsyncThunk(
    'pendingRelease/releaseVouchers',
    async (ids: number[], { rejectWithValue }) => {
        try {
            const response = await api.post('/v1/vouchers/pending-release/release', { ids });
            return response.data?.data as { released: number; skipped: number; voucher_ids: number[] };
        } catch (err: any) {
            return rejectWithValue(
                err.response?.data?.message || 'Failed to release vouchers.',
            );
        }
    },
);

export const releaseBulkJob = createAsyncThunk(
    'pendingRelease/releaseBulkJob',
    async (jobId: number, { rejectWithValue }) => {
        try {
            const response = await api.post(`/v1/vouchers/pending-release/release-job/${jobId}`);
            return response.data?.data as { released: number; skipped: number; voucher_ids: number[] };
        } catch (err: any) {
            return rejectWithValue(
                err.response?.data?.message || 'Failed to release bulk job.',
            );
        }
    },
);

const pendingReleaseSlice = createSlice({
    name: 'pendingRelease',
    initialState,
    reducers: {
        clearPendingRelease(state) {
            state.items = [];
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchPendingRelease.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(fetchPendingRelease.fulfilled, (state, action) => {
                state.isLoading = false;
                state.items = action.payload.items;
                state.pagination = action.payload.pagination;
            })
            .addCase(fetchPendingRelease.rejected, (state, action) => {
                state.isLoading = false;
                state.error = (action.payload as string) || 'Failed to fetch pending-release vouchers.';
            })
            .addCase(releaseVouchers.pending, (state) => {
                state.isReleasing = true;
                state.error = null;
            })
            .addCase(releaseVouchers.fulfilled, (state) => {
                state.isReleasing = false;
            })
            .addCase(releaseVouchers.rejected, (state, action) => {
                state.isReleasing = false;
                state.error = (action.payload as string) || 'Failed to release vouchers.';
            })
            .addCase(releaseBulkJob.pending, (state) => {
                state.isReleasing = true;
                state.error = null;
            })
            .addCase(releaseBulkJob.fulfilled, (state) => {
                state.isReleasing = false;
            })
            .addCase(releaseBulkJob.rejected, (state, action) => {
                state.isReleasing = false;
                state.error = (action.payload as string) || 'Failed to release bulk job.';
            });
    },
});

export const { clearPendingRelease } = pendingReleaseSlice.actions;
export default pendingReleaseSlice.reducer;
