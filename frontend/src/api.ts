import axios from 'axios';

function determineBackendUrl(): string {
    const envBackend = (import.meta.env.VITE_BACKEND_URL || '').trim();
    // Ignore private Airo preview subdomains if mistakenly injected
    if (envBackend && !envBackend.includes('airoapp.ai')) {
        return envBackend.replace(/\/+$/, '');
    }
    // In production on kidsynq.com domain
    if (typeof window !== 'undefined' && window.location.hostname.includes('kidsynq.com')) {
        return 'https://api.kidsynq.com';
    }
    // Local dev (Vite dev server handles proxy to 127.0.0.1:8000)
    if (import.meta.env.DEV) {
        return '';
    }
    return 'https://api.kidsynq.com';
}

function determineApiBaseUrl(backendUrl: string): string {
    const envApi = (import.meta.env.VITE_API_URL || '').trim();
    if (envApi && !envApi.includes('airoapp.ai')) {
        return envApi.endsWith('/') ? envApi : `${envApi}/`;
    }
    if (typeof window !== 'undefined' && window.location.hostname.includes('kidsynq.com')) {
        return 'https://api.kidsynq.com/api/';
    }
    if (import.meta.env.DEV) {
        return '/api/';
    }
    return backendUrl ? `${backendUrl.replace(/\/+$/, '')}/api/` : 'https://api.kidsynq.com/api/';
}

export const BACKEND_URL = determineBackendUrl();
export const API_BASE_URL = determineApiBaseUrl(BACKEND_URL);

const api = axios.create({
    baseURL: API_BASE_URL,
});

// Request interceptor to add the access token to headers
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // If the error status is 401 and there is no originalRequest._retry flag,
        // it means the token has expired and we need to refresh it
        if (error.response && error.response.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            const refreshToken = localStorage.getItem('refresh_token');
            if (!refreshToken) {
                localStorage.removeItem('access_token');
                return Promise.reject(error);
            }

            try {
                const response = await axios.post(`${API_BASE_URL}token/refresh/`, {
                    refresh: refreshToken,
                });

                const { access } = response.data;

                localStorage.setItem('access_token', access);

                // Retry the original request with the new token
                originalRequest.headers.Authorization = `Bearer ${access}`;
                return axios(originalRequest);
            } catch (refreshError) {
                // If refresh token fails, log out
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                if (!window.location.pathname.includes('/login')) {
                    window.location.href = '/login';
                }
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default api;
