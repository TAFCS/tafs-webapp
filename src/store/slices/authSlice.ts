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
  // Tokens are NOT stored here — they live in httpOnly cookies managed by the
  // backend. Redux only holds the in-memory user object for UI rendering.
  isAuthenticated: boolean;
  isLoading: boolean;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true, // true on boot — silently verifying the httpOnly refresh cookie
};

// ─── Slice ────────────────────────────────────────────────────────────────────

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ user: StaffUser }>) {
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.isLoading = false;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    clearCredentials(state) {
      state.user = null;
      state.isAuthenticated = false;
      state.isLoading = false;
    },
  },
});

export const { setCredentials, setLoading, clearCredentials } = authSlice.actions;
export default authSlice.reducer;
