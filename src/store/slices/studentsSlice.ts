import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../lib/api';

// ─── Types matches backend DTOs & Responses ────────────────────────────────

export interface StudentListItem {
  id: number;
  student_full_name: string;
  gr_number: string | null;
  cc_number: string | null;
  campus: string | null;
  grade_and_section: string | null;
  primary_guardian_name: string | null;
  whatsapp_number: string | null;
  enrollment_status: string | null;
  financial_status_badge: string | null;
  family_id: number | null;
  household_name: string | null;
  total_outstanding_balance: number | null;
  advance_credit_balance: number | null;
  primary_guardian_cnic: string | null;
  date_of_birth: string | null;
  registration_number: string | null;
  house_and_color: string | null;
  residential_address: string | null;
}

export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface StudentsState {
  items: StudentListItem[];
  meta: PaginatedMeta | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: StudentsState = {
  items: [],
  meta: null,
  isLoading: false,
  error: null,
};

// ─── Async Thunks ─────────────────────────────────────────────────────────────

export const fetchStudents = createAsyncThunk(
  'students/fetchAll',
  async (
    params: { page?: number; limit?: number; search?: string; campus?: string; status?: string; fields?: string } = {},
    { rejectWithValue }
  ) => {
    try {
      const response = await api.get('/v1/students', { params });
      return response.data.data;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message || 'Failed to fetch students. Please try again.'
      );
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

export const studentsSlice = createSlice({
  name: 'students',
  initialState,
  reducers: {
    clearStudents(state) {
      state.items = [];
      state.meta = null;
      state.error = null;
      state.isLoading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStudents.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchStudents.fulfilled, (state, action: PayloadAction<{ items: StudentListItem[]; pagination: PaginatedMeta }>) => {
        state.isLoading = false;
        state.items = action.payload.items;
        state.meta = action.payload.pagination;
      })
      .addCase(fetchStudents.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearStudents } = studentsSlice.actions;
export default studentsSlice.reducer;
