// In dev: Vite proxies /api → localhost:3001
// In prod: calls go directly to the backend URL
export const API_BASE = import.meta.env.VITE_SOCKET_URL
  ? import.meta.env.VITE_SOCKET_URL
  : ''

export const apiUrl = (path: string) => `${API_BASE}${path}`
