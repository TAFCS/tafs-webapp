import axios from "axios";

const baseURL = typeof window !== 'undefined'
    ? '/api'
    : process.env.NEXT_PUBLIC_API_URL;

const api = axios.create({
    baseURL,
    headers: {
        "Content-Type": "application/json",
    },
    // Send httpOnly auth cookies (tafs_access, tafs_refresh) on every request.
    // The browser attaches them automatically — no manual Authorization header needed.
    withCredentials: true,
});

// Handle 401 globally — silently re-issue tokens via the httpOnly refresh cookie,
// then retry all queued requests. No tokens ever touch JavaScript.
let isRefreshing = false;
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
                }).then(() => api(originalRequest));
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

                processQueue(null);
                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError);
                if (typeof window !== "undefined") {
                    // Only non-sensitive display data lives in localStorage
                    localStorage.removeItem("tafs_user");
                    window.location.href = "/auth/login";
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

