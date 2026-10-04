import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://water-management-system-kt4z.onrender.com/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

if (typeof window !== 'undefined' && (window as any).electronAPI?.getApiUrl) {
  (window as any).electronAPI.getApiUrl().then((url: string) => {
    if (url) {
      apiClient.defaults.baseURL = url;
    }
  }).catch(() => {});
}

/**
 * Retrieves a stored token, prioritizing Electron SafeStorage (DPAPI/Keychain)
 * with graceful fallback to localStorage in browser environments.
 */
export async function getSecureToken(key: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if ((window as any).electronAPI?.getSecureToken) {
    try {
      const token = await (window as any).electronAPI.getSecureToken(key);
      if (token) return token;
    } catch {}
  }
  return localStorage.getItem(key);
}

/**
 * Stores a token securely via Electron SafeStorage (DPAPI/Keychain)
 * with graceful fallback to localStorage.
 */
export async function setSecureToken(key: string, value: string | null): Promise<void> {
  if (typeof window === 'undefined') return;
  if ((window as any).electronAPI?.setSecureToken) {
    try {
      await (window as any).electronAPI.setSecureToken(key, value);
      // Ensure no unencrypted token remains in localStorage when running inside Electron
      try { localStorage.removeItem(key); } catch {}
      return;
    } catch {}
  }
  if (value) {
    localStorage.setItem(key, value);
  } else {
    localStorage.removeItem(key);
  }
}

apiClient.interceptors.request.use(async (config) => {
  if (typeof window !== 'undefined') {
    const token = await getSecureToken('water_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      if (typeof window !== 'undefined') {
        const refreshToken = await getSecureToken('water_refresh_token');
        if (refreshToken) {
          try {
            const currentBaseUrl = apiClient.defaults.baseURL || API_BASE_URL;
            const { data } = await axios.post(`${currentBaseUrl}/auth/refresh`, { refreshToken });
            await setSecureToken('water_access_token', data.accessToken);
            await setSecureToken('water_refresh_token', data.refreshToken);
            originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
            return apiClient(originalRequest);
          } catch (refreshError) {
            await setSecureToken('water_access_token', null);
            await setSecureToken('water_refresh_token', null);
            localStorage.removeItem('water_user');
            window.location.href = '/login';
          }
        } else {
          await setSecureToken('water_access_token', null);
          localStorage.removeItem('water_user');
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
      }
    }
    return Promise.reject(error);
  },
);
