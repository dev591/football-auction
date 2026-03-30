// In dev: Vite proxies /api → localhost:3001 (BASE = '')
// In prod: calls go directly to Railway backend
const BASE = import.meta.env.VITE_API_URL || ''

export const apiFetch = async (url: string, options: RequestInit = {}) => {
  return fetch(BASE + url, options)
}

export const authFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('striker_token')

  const headers = new Headers(options.headers || {})
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(BASE + url, { ...options, headers })

  if (response.status === 401) {
    localStorage.removeItem('striker_token')
    localStorage.removeItem('striker_team')
    window.location.href = '/'
  }

  return response
}
