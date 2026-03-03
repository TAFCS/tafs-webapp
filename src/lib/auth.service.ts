import api from './api';
import type { StaffUser } from '@/store/slices/authSlice';

// ─── Response Types ───────────────────────────────────────────────────────────

export interface StaffLoginResponse {
  accessToken: string;
  refreshToken: string;
  user: StaffUser;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

// ─── Auth Service ─────────────────────────────────────────────────────────────

export const authService = {
  /**
   * POST /api/v1/auth/staff/login
   * Body: { username, password }
   */
  async loginStaff(username: string, password: string): Promise<StaffLoginResponse> {
    const { data } = await api.post<StaffLoginResponse>('/api/v1/auth/staff/login', {
      username,
      password,
    });
    return data;
  },

  /**
   * POST /api/v1/auth/staff/refresh
   * Rotates both tokens (token rotation pattern).
   */
  async refreshStaff(refreshToken: string): Promise<RefreshResponse> {
    const { data } = await api.post<RefreshResponse>('/api/v1/auth/staff/refresh', {
      refreshToken,
    });
    return data;
  },

  /**
   * POST /api/v1/auth/staff/logout
   * Requires valid access token — handled automatically by api interceptor.
   */
  async logoutStaff(): Promise<void> {
    await api.post('/api/v1/auth/staff/logout');
  },
};
