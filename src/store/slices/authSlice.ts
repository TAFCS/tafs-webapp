import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// ─── Types (matches /api/v1/auth/staff/login response) ───────────────────────

/**
 * A user's universal data scope — which records they may touch.
 *
 * An EMPTY array on a dimension means UNRESTRICTED on that dimension, not
 * "nothing". Dimensions AND together. Mirrors UserScope on the backend
 * (tafs-backend/src/common/scope/scope.types.ts).
 */
export interface UserScope {
  campuses: number[];
  segments: number[];
  classes: number[];
  sections: number[];
  departments: number[];
  staffCategories: number[];
}

export const EMPTY_USER_SCOPE: UserScope = {
  campuses: [],
  segments: [],
  classes: [],
  sections: [],
  departments: [],
  staffCategories: [],
};

export interface StaffUser {
  id: string;
  username: string;
  fullName: string;
  role: string;
  campusId: number | null;
  campusName: string | null;
  allowedClassIds: number[];
  permissions: string[];
  effectiveTileIds?: string[];
  /** Tile sub-permissions held, as `tileId#actionId`. */
  effectiveActions?: string[];
  /** Absent on sessions issued before scope shipped — treated as unrestricted. */
  scope?: UserScope;
  payrollEnabled?: boolean;
  hasEmployeeProfile?: boolean;
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
