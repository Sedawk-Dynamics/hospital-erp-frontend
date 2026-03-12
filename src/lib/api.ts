import apiClient from '@/lib/api-client';
import type { AxiosRequestConfig } from 'axios';
import type { ApiResponse } from '@/lib/api-client';

// ============================================================
// Auth Token Helpers
// ============================================================

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refreshToken');
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
  // Also set a cookie so Next.js middleware (server-side) can check auth
  document.cookie = `accessToken=${accessToken}; path=/; max-age=${15 * 60}; SameSite=Lax`;
}

export function clearTokens(): void {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  // Clear the cookie too
  document.cookie = 'accessToken=; path=/; max-age=0';
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

// ============================================================
// Generic Typed API Functions
// ============================================================

export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
  const { data } = await apiClient.get<ApiResponse<T>>(url, config);
  return data;
}

export async function apiPost<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
  const { data } = await apiClient.post<ApiResponse<T>>(url, body, config);
  return data;
}

export async function apiPut<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
  const { data } = await apiClient.put<ApiResponse<T>>(url, body, config);
  return data;
}

export async function apiPatch<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
  const { data } = await apiClient.patch<ApiResponse<T>>(url, body, config);
  return data;
}

export async function apiDelete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
  const { data } = await apiClient.delete<ApiResponse<T>>(url, config);
  return data;
}

export { apiClient };
export type { ApiResponse };
