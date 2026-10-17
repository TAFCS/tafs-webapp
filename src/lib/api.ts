import axios from "axios";
import { resolveApiBaseURL } from "./api-base";
import { clearWebSession, markWebSession } from "./web-session";

const baseURL = resolveApiBaseURL();

const api = axios.create({
    baseURL,
    // Fail before the UI spins forever on a hung Railway upstream (prod 499s).
    timeout: 30_000,
    // Send httpOnly auth cookies (tafs_access, tafs_refresh) on every request.
    // The browser attaches them automatically — no manual Authorization header needed.
    withCredentials: true,
    // Serialize array params as repeated keys (types=a&types=b) rather than
    // bracket notation (types[]=a&types[]=b) which NestJS ValidationPipe rejects.
    paramsSerializer: {
        serialize: (params) => {
            const sp = new URLSearchParams();
            for (const [key, value] of Object.entries(params)) {
                if (Array.isArray(value)) {
                    value.forEach((v) => sp.append(key, String(v)));
                } else if (value !== undefined && value !== null) {
                    sp.append(key, String(value));
                }
            }
            return sp.toString();
        },
    },
});

// Handle 401 globally — silently re-issue tokens via the httpOnly refresh cookie,
// then retry all queued requests. No tokens ever touch JavaScript.
let isRefreshing = false;

function wasImpersonating(): boolean {
    try {
        const raw = localStorage.getItem("tafs_user");
        return !!(raw && JSON.parse(raw)?.impersonator);
    } catch {
        return false;
    }
}
let failedQueue: Array<{ resolve: () => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown) {
    failedQueue.forEach((p) => {
        if (error) p.reject(error);
        else p.resolve();
    });
    failedQueue = [];
}

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        const isAuthEndpoint =
            originalRequest?.url?.includes("/auth/staff/login") ||
            originalRequest?.url?.includes("/auth/staff/refresh") ||
            originalRequest?.url?.includes("/auth/parent/login") ||
            originalRequest?.url?.includes("/auth/parent/refresh");

        if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
            if (isRefreshing) {
                // Park concurrent requests until the ongoing refresh completes
                return new Promise<void>((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(() => {
                    originalRequest._retry = true;
                    return api(originalRequest);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                // No body needed — the browser sends the httpOnly tafs_refresh
                // cookie automatically because withCredentials = true
                await axios.post(
                    `${baseURL}/v1/auth/staff/refresh`,
                    {},
                    { withCredentials: true },
                );
                await markWebSession();

                // An impersonation token lapsing refreshes into the admin's
                // own session (TAFSD-361); reload so nothing keeps showing
                // the impersonated user's data.
                if (typeof window !== "undefined" && wasImpersonating()) {
                    localStorage.removeItem("tafs_user");
                    window.location.href = "/system/users";
                    return new Promise(() => {});
                }

                processQueue(null);
                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError);
                if (typeof window !== "undefined") {
                    // Only non-sensitive display data lives in localStorage
                    localStorage.removeItem("tafs_user");
                    await clearWebSession();
                    if (window.location.pathname !== "/auth/login") {
                        window.location.href = "/auth/login";
                    }
                }
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default api;
