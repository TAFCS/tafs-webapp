import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ClassItem {
    id: number;
    description: string;
    class_code: string;
    academic_system: string;
    class_order?: number; // Numeric grade rank returned by the backend
}

export interface ClassesState {
    items: ClassItem[];
    isLoading: boolean;
    error: string | null;
}

const initialState: ClassesState = {
    items: [],
    isLoading: false,
    error: null,
};

// ─── Async Thunk ─────────────────────────────────────────────────────────────

export const fetchClasses = createAsyncThunk(
    'classes/fetchAll',
    async (_, { rejectWithValue }) => {
        try {
            const response = await api.get('/v1/classes');
            const data = response.data?.data;
            return Array.isArray(data) ? data : [];
        } catch (err: any) {
            return rejectWithValue(
                err.response?.data?.message || 'Failed to fetch classes.'
            );
        }
    }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

export const classesSlice = createSlice({
    name: 'classes',
    initialState,
    reducers: {
        clearClasses(state) {
            state.items = [];
            state.error = null;
            state.isLoading = false;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchClasses.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(fetchClasses.fulfilled, (state, action: PayloadAction<ClassItem[]>) => {
                state.isLoading = false;
                state.items = action.payload;
            })
            .addCase(fetchClasses.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            });
    },
});

export const { clearClasses } = classesSlice.actions;
export default classesSlice.reducer;
