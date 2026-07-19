import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CampusSection {
    id: number;
    description: string;
    campus_section_id: number;
    is_active: boolean;
    student_capacity?: number | null;
    gender_mode?: 'COED' | 'BOYS_ONLY' | 'GIRLS_ONLY' | string;
    enrolled_count?: number;
    remaining_seats?: number | null;
    is_full?: boolean;
    male_count?: number;
    female_count?: number;
    unknown_count?: number;
    capacity_conflict_count?: number;
    gender_conflict_count?: number;
}

export interface CampusClass {
    id: number;
    description: string;
    class_code: string;
    academic_system: string;
    campus_class_id: number;
    is_active: boolean;
    sections: CampusSection[];
}

export interface CampusItem {
    id: number;
    campus_code: string;
    campus_name: string;
    address?: string;
    offered_classes?: CampusClass[];
}

export interface CampusesState {
    items: CampusItem[];
    isLoading: boolean;
    error: string | null;
}

const initialState: CampusesState = {
    items: [],
    isLoading: false,
    error: null,
};

// ─── Async Thunk ─────────────────────────────────────────────────────────────

export const fetchCampuses = createAsyncThunk(
    'campuses/fetchAll',
    async (_, { rejectWithValue }) => {
        try {
            const response = await api.get('/v1/campuses');
            const data = response.data?.data;
            return Array.isArray(data) ? data : [];
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
            .addCase(fetchCampuses.fulfilled, (state, action: PayloadAction<CampusItem[]>) => {
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
