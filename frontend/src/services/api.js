import axios from 'axios'

const backendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.PUBLIC_API_URL || ''
console.log('VITE_BACKEND_URL:', import.meta.env.VITE_BACKEND_URL)
console.log('PUBLIC_API_URL:', import.meta.env.PUBLIC_API_URL)
console.log('Final baseURL:', backendUrl)

const api = axios.create({
  baseURL: backendUrl,
})

function getActiveToken() {
  const stores = ['solar-tech-auth', 'solar-auth-storage']
  for (const storeName of stores) {
    try {
      const raw = localStorage.getItem(storeName)
      if (!raw) continue
      const { state } = JSON.parse(raw)
      if (state?.isAuthenticated && state?.accessToken) {
        return { token: state.accessToken, refreshToken: state.refreshToken, storeName }
      }
    } catch {}
  }
  return { token: null, refreshToken: null, storeName: null }
}

function updateTokenInStore(storeName, newToken) {
  try {
    const raw = localStorage.getItem(storeName)
    if (!raw) return
    const parsed = JSON.parse(raw)
    parsed.state.accessToken = newToken
    localStorage.setItem(storeName, JSON.stringify(parsed))
  } catch {}
}

api.interceptors.request.use((config) => {
  if (config.headers.Authorization) return config
  const { token } = getActiveToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      const { refreshToken, storeName } = getActiveToken()

      if (refreshToken && storeName) {
        try {
          const response = await api.post('/api/auth/refresh', {
            refresh_token: refreshToken,
          })
          const newToken = response.data.access_token
          updateTokenInStore(storeName, newToken)
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          return api(originalRequest)
        } catch {
          localStorage.removeItem(storeName)
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

export default api
