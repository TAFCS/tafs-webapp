import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FeeTypeItem {
    id: number;
    description: string;
    freq: 'MONTHLY' | 'ONE_TIME' | null;
    breakup: Record<string, any> | null;
    priority_order?: number;
}

export interface FeeTypesState {
    items: FeeTypeItem[];
    isLoading: boolean;
    error: string | null;
}

const initialState: FeeTypesState = {
    items: [],
    isLoading: false,
    error: null,
};

// ─── Async Thunk ─────────────────────────────────────────────────────────────

export const fetchFeeTypes = createAsyncThunk(
    'feeTypes/fetchAll',
    async (_, { rejectWithValue }) => {
        try {
            const response = await api.get('/v1/fee-types');
            const data = response.data?.data;
            return Array.isArray(data) ? data : [];
        } catch (err: any) {
            return rejectWithValue(
                err.response?.data?.message || 'Failed to fetch fee types.'
            );
        }
    }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

export const feeTypesSlice = createSlice({
    name: 'feeTypes',
    initialState,
    reducers: {
        clearFeeTypes(state) {
            state.items = [];
            state.error = null;
            state.isLoading = false;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchFeeTypes.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(fetchFeeTypes.fulfilled, (state, action: PayloadAction<FeeTypeItem[]>) => {
                state.isLoading = false;
                state.items = action.payload;
            })
            .addCase(fetchFeeTypes.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            });
    },
});

export const { clearFeeTypes } = feeTypesSlice.actions;
export default feeTypesSlice.reducer;
