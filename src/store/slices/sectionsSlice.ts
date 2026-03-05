import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SectionItem {
    id: number;
    description: string;
}

export interface SectionsState {
    items: SectionItem[];
    isLoading: boolean;
    error: string | null;
}

const initialState: SectionsState = {
    items: [],
    isLoading: false,
    error: null,
};

// ─── Async Thunk ─────────────────────────────────────────────────────────────

export const fetchSections = createAsyncThunk(
    'sections/fetchAll',
    async (_, { rejectWithValue }) => {
        try {
            const response = await api.get('/v1/sections');
            const data = response.data?.data;
            return Array.isArray(data) ? data : [];
        } catch (err: any) {
            return rejectWithValue(
                err.response?.data?.message || 'Failed to fetch sections.'
            );
        }
    }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

export const sectionsSlice = createSlice({
    name: 'sections',
    initialState,
    reducers: {
        clearSections(state) {
            state.items = [];
            state.error = null;
            state.isLoading = false;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchSections.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(fetchSections.fulfilled, (state, action: PayloadAction<SectionItem[]>) => {
                state.isLoading = false;
                state.items = action.payload;
            })
            .addCase(fetchSections.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            });
    },
});

export const { clearSections } = sectionsSlice.actions;
export default sectionsSlice.reducer;
