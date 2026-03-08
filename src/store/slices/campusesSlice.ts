import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Campus, campusesService } from '../../lib/campuses.service';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CampusesState {
    items: Campus[];
    isLoading: boolean;
    error: string | null;
}

const initialState: CampusesState = {
    items: [],
    isLoading: false,
    error: null,
};

// ─── Async Thunks ─────────────────────────────────────────────────────────────

export const fetchCampuses = createAsyncThunk(
    'campuses/fetchAll',
    async (_, { rejectWithValue }) => {
        try {
            const data = await campusesService.list();
            return data;
        } catch (err: any) {
            return rejectWithValue(
                err.response?.data?.message || 'Failed to fetch campuses.'
            );
        }
    }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

export const campusesSlice = createSlice({
    name: 'campuses',
    initialState,
    reducers: {
        clearCampuses(state) {
            state.items = [];
            state.error = null;
            state.isLoading = false;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchCampuses.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(fetchCampuses.fulfilled, (state, action: PayloadAction<Campus[]>) => {
                state.isLoading = false;
                state.items = action.payload;
            })
            .addCase(fetchCampuses.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            });
    },
});

export const { clearCampuses } = campusesSlice.actions;
export default campusesSlice.reducer;
