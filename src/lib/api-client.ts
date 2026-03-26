import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach Bearer token + Tenant ID
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;

    try {
      const raw = localStorage.getItem('selectedClinic');
      if (raw) {
        const clinic = JSON.parse(raw);
        if (clinic?.id) config.headers['X-Tenant-Id'] = clinic.id;
      }
    } catch {
      // ignore parse errors
    }
  }
  return config;
});

// Response interceptor: handle 401 with token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/auth/refresh`,
          { refreshToken }
        );
        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        document.cookie = `accessToken=${data.data.accessToken}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
        originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return apiClient(originalRequest);
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        document.cookie = 'accessToken=; path=/; max-age=0';
        if (typeof window !== 'undefined') window.location.href = '/login';
        return Promise.reject(error);
      }
    }
    // Handle subscription expired (403 with SUBSCRIPTION_EXPIRED message)
    // Redirect to subscription expired screen — but NOT on pages where
    // the user needs access to manage their subscription or switch hospitals.
    if (
      error.response?.status === 403 &&
      error.response?.data?.message === 'SUBSCRIPTION_EXPIRED' &&
      typeof window !== 'undefined'
    ) {
      const path = window.location.pathname;
      const allowedPaths = [
        '/subscription-expired',
        '/super-admin',
        '/login',
        '/register',
        '/select-hospital',
        '/manage-subscription',
        '/my-account',
        '/contact',
      ];
      const isAllowed = allowedPaths.some((p) => path.startsWith(p));
      if (!isAllowed) {
        window.location.href = '/subscription-expired';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
