import axios from "axios";

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Attach JWT access token to every request automatically
api.interceptors.request.use((config) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle 401 globally — try refresh first, only log out if refresh also fails
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null = null) {
    failedQueue.forEach((p) => {
        if (error) p.reject(error);
        else p.resolve(token!);
    });
    failedQueue = [];
}

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Skip retry logic for auth endpoints themselves to avoid infinite loops
        const isAuthEndpoint =
            originalRequest?.url?.includes("/auth/staff/login") ||
            originalRequest?.url?.includes("/auth/staff/refresh") ||
            originalRequest?.url?.includes("/auth/parent/login");

        if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
            if (isRefreshing) {
                // Queue this request until refresh completes
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then((token) => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return api(originalRequest);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            const refreshToken =
                typeof window !== "undefined" ? localStorage.getItem("tafs_refresh_token") : null;

            if (!refreshToken) {
                // No refresh token — force logout
                if (typeof window !== "undefined") {
                    localStorage.clear();
                    window.location.href = "/auth/login";
                }
                return Promise.reject(error);
            }

            try {
                const { data } = await axios.post(
                    `${process.env.NEXT_PUBLIC_API_URL}/v1/auth/staff/refresh`,
                    { refreshToken }
                );

                const newToken: string = data.accessToken;
                const newRefresh: string = data.refreshToken;

                localStorage.setItem("access_token", newToken);
                localStorage.setItem("tafs_access_token", newToken);
                localStorage.setItem("tafs_refresh_token", newRefresh);

                api.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
                originalRequest.headers.Authorization = `Bearer ${newToken}`;

                processQueue(null, newToken);
                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                // Refresh also failed — session is truly expired
                if (typeof window !== "undefined") {
                    localStorage.clear();
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

