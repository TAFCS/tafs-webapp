import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VoucherStudent {
    cc: number;
    full_name: string;
    gr_number: string | null;
}

export interface VoucherCampus {
    id: number;
    campus_name: string;
}

export interface VoucherClass {
    id: number;
    description: string;
}

export interface VoucherSection {
    id: number;
    description: string;
}

export interface VoucherBankAccount {
    id: number;
    bank_name: string;
    account_title: string;
    account_number: string;
    branch_code: string | null;
    bank_address: string | null;
    iban: string | null;
}

export interface VoucherHead {
    id: number;
    voucher_id: number;
    student_fee_id: number;
    discount_amount: string;
    net_amount: string;
    amount_deposited: string;
    balance: string;
    student_fees?: {
        id: number;
        amount_before_discount: string;
        month: number | null;
        target_month: number | null;
        academic_year: string | null;
        fee_types: {
            description: string;
        };
    };

}

export interface VoucherItem {
    id: number;
    student_id: number;
    campus_id: number;
    class_id: number;
    section_id: number | null;
    bank_account_id: number;
    issue_date: string;
    due_date: string;
    validity_date: string | null;
    status: string | null;
    pdf_url?: string | null;
    late_fee_charge: boolean;
    academic_year: string | null;
    month: number | null;
    total_payable_before_due?: string;
    total_payable_after_due?: string;
    late_fee_deposited?: string;
    students: VoucherStudent;
    campuses: VoucherCampus;
    classes: VoucherClass;
    sections: VoucherSection | null;
    bank_accounts: VoucherBankAccount;
    voucher_heads?: VoucherHead[];
}

export interface VoucherFilters {
    campus_id?: number;
    class_id?: number;
    section_id?: number;
    cc?: number;
    gr?: string;
    id?: number;
    status?: string;
}

export interface VouchersState {
    items: VoucherItem[];
    isLoading: boolean;
    error: string | null;
    activeFilters: VoucherFilters;
}

const initialState: VouchersState = {
    items: [],
    isLoading: false,
    error: null,
    activeFilters: {},
};

// ─── Async Thunk ─────────────────────────────────────────────────────────────

export const fetchVouchers = createAsyncThunk(
    'vouchers/fetchAll',
    async (filters: VoucherFilters = {}, { rejectWithValue }) => {
        try {
            const params: Record<string, string | number> = {};
            if (filters.campus_id) params.campus_id = filters.campus_id;
            if (filters.class_id) params.class_id = filters.class_id;
            if (filters.section_id) params.section_id = filters.section_id;
            if (filters.cc) params.cc = filters.cc;
            if (filters.gr) params.gr = filters.gr;
            if (filters.status) params.status = filters.status;
            if (filters.id) params.id = filters.id;

            const response = await api.get('/v1/vouchers', { params });
            const data = response.data?.data;
            return Array.isArray(data) ? data : [];
        } catch (err: any) {
            return rejectWithValue(
                err.response?.data?.message || 'Failed to fetch vouchers.'
            );
        }
    }
);

export const fetchVouchersByStudent = createAsyncThunk(
    'vouchers/fetchByStudent',
    async (cc: number, { rejectWithValue }) => {
        try {
            const response = await api.get(`/v1/vouchers/by-student/${cc}`);
            const data = response.data?.data;
            return Array.isArray(data) ? data : [];
        } catch (err: any) {
            return rejectWithValue(
                err.response?.data?.message || 'Failed to fetch student vouchers.'
            );
        }
    }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

export const vouchersSlice = createSlice({
    name: 'vouchers',
    initialState,
    reducers: {
        clearVouchers(state) {
            state.items = [];
            state.error = null;
            state.isLoading = false;
        },
        setActiveFilters(state, action: PayloadAction<VoucherFilters>) {
            state.activeFilters = action.payload;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchVouchers.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(fetchVouchers.fulfilled, (state, action: PayloadAction<VoucherItem[]>) => {
                state.isLoading = false;
                state.items = action.payload;
            })
            .addCase(fetchVouchers.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            })
            .addCase(fetchVouchersByStudent.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(fetchVouchersByStudent.fulfilled, (state, action: PayloadAction<VoucherItem[]>) => {
                state.isLoading = false;
                state.items = action.payload;
            })
            .addCase(fetchVouchersByStudent.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            });
    },
});

export const { clearVouchers, setActiveFilters } = vouchersSlice.actions;
export default vouchersSlice.reducer;
