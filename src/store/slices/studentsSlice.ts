import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../lib/api';

// ─── Types matches backend DTOs & Responses ────────────────────────────────

export interface StudentListItem {
  id: number;
  cc?: number;
  student_full_name: string;
  full_name?: string | null;
  gr_number: string | null;
  cc_number: string | null;
  class_id?: number | null;
  campus: string | null;
  grade_and_section: string | null;
  primary_guardian_name: string | null;
  whatsapp_number: string | null;
  enrollment_status: string | null;
  financial_status_badge: string | null;
  family_id: number | null;
  household_name: string | null;
  home_phone?: string | null;
  total_outstanding_balance: number | null;
  advance_credit_balance: number | null;
  primary_guardian_cnic: string | null;
  date_of_birth: string | null;
  gender: string | null;
  registration_number: string | null;
  date_of_admission: string | null;
  house_and_color: string | null;
  residential_address: string | null;
   photograph_url?: string | null;
  father_name?: string | null;
  student_flags?: Array<{
    id: number;
    flag: string;
    reminder_date: string | null;
    work_done: boolean;
  }>;
  siblings?: {
    id: number;
    cc: number;
    full_name: string;
    cc_number: string;
    gr_number?: string | null;
    grade?: string;
    father_name?: string;
    photograph_url?: string | null;
  }[];
  potential_family_match?: {
    id: number;
    household_name: string;
    spouse_name?: string;
    spouse_cnic?: string;
  } | null;
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

export interface FetchStudentsParams {
  page?: number;
  limit?: number;
  search?: string;
  campus_id?: number;
  status?: 'SOFT_ADMISSION' | 'ENROLLED' | 'EXPELLED' | 'GRADUATED';
  fields?: string;
  grade?: string;
  section?: string;
  financial_status?: string[];
  has_siblings?: boolean;
  house?: string;
}

export const fetchStudents = createAsyncThunk(
  'students/fetchAll',
  async (
    params: FetchStudentsParams = {},
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
      .addCase(fetchStudents.fulfilled, (state, action: PayloadAction<{ items: StudentListItem[]; meta: PaginatedMeta }>) => {
        state.isLoading = false;
        state.items = action.payload.items;
        state.meta = action.payload.meta;
      })
      .addCase(fetchStudents.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearStudents } = studentsSlice.actions;
export default studentsSlice.reducer;
