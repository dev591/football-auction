export const authFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('striker_token')

  const headers = new Headers(options.headers || {})
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  
  // Only add Content-Type if it's not FormData
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    localStorage.removeItem('striker_token')
    localStorage.removeItem('striker_team')
    window.location.href = '/'
  }

  return response
}
