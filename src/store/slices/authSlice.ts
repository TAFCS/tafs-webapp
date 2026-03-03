import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// ─── Types (matches /api/v1/auth/staff/login response) ───────────────────────

export interface StaffUser {
  id: string;
  username: string;
  fullName: string;
  role: string;
  campusId: number | null;
  campusName: string | null;
}

interface AuthState {
  user: StaffUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true, // true on boot — we check localStorage before rendering
};

// ─── Slice ────────────────────────────────────────────────────────────────────

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(
      state,
      action: PayloadAction<{
        accessToken: string;
        refreshToken: string;
        user: StaffUser;
      }>
    ) {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.isLoading = false;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    clearCredentials(state) {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.isLoading = false;
    },
  },
});

export const { setCredentials, setLoading, clearCredentials } = authSlice.actions;
export default authSlice.reducer;
