import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../services/api'
import { db } from '../services/db'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      loading: false,
      error: null,

      // Login para ambos roles (admin y tecnico)
      login: async (email, password, rol = 'administrador') => {
        set({ loading: true, error: null })
        try {
          // Validar rol
          if (!['administrador', 'tecnico'].includes(rol)) {
            throw new Error('Rol inválido')
          }

          // Realizar login
          const response = await api.post('/api/auth/login', { email, password })
          const { access_token, refresh_token } = response.data

          // Obtener información del usuario
          const meResponse = await api.get('/api/auth/me', {
            headers: { Authorization: `Bearer ${access_token}` },
          })

          // Validar rol del usuario
          if (meResponse.data.rol !== rol) {
            set({ loading: false })
            return {
              success: false,
              error: `Esta cuenta no es de ${rol === 'administrador' ? 'administrador' : 'técnico'}`,
            }
          }

          // Guardar en estado
          set({
            accessToken: access_token,
            refreshToken: refresh_token,
            isAuthenticated: true,
            user: meResponse.data,
            loading: false,
            error: null,
          })

          return { success: true }
        } catch (error) {
          const errorMsg = error.response?.data?.detail || error.message || 'Error al iniciar sesión'
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            loading: false,
            error: errorMsg,
          })
          return {
            success: false,
            error: errorMsg,
          }
        }
      },

      // Logout seguro con blacklist
      logout: async () => {
        set({ loading: true })
        try {
          const { accessToken } = get()
          if (accessToken) {
            // Llamar endpoint de logout para agregar a blacklist
            await api.post('/api/auth/logout', { access_token: accessToken })
          }
          // Limpiar datos locales (IndexedDB)
          await db.clearAll()
        } catch (error) {
          console.error('Error during logout:', error)
        } finally {
          // Limpiar estado sin importar si logout falló
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            loading: false,
            error: null,
          })
        }
      },

      // Refresh token
      refreshAccessToken: async () => {
        try {
          const { refreshToken } = get()
          if (!refreshToken) return false

          const response = await api.post('/api/auth/refresh', {
            refresh_token: refreshToken,
          })

          const { access_token, refresh_token: newRefreshToken } = response.data

          set({
            accessToken: access_token,
            refreshToken: newRefreshToken,
          })

          return true
        } catch (error) {
          // Si refresh falla, hacer logout
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
          })
          return false
        }
      },

      // Actualizar perfil del usuario
      updateUser: (userData) => {
        set({ user: userData })
      },

      // Limpiar error
      clearError: () => {
        set({ error: null })
      },

      // Obtener rol actual
      getRole: () => {
        const { user } = get()
        return user?.rol || null
      },

      // Verificar si es admin
      isAdmin: () => {
        const { user } = get()
        return user?.rol === 'administrador'
      },

      // Verificar si es técnico
      isTechnic: () => {
        const { user } = get()
        return user?.rol === 'tecnico'
      },

      // Verificar si tiene permiso para rol específico
      hasRole: (roles) => {
        const { user } = get()
        if (!user) return false
        if (typeof roles === 'string') return user.rol === roles
        return roles.includes(user.rol)
      },
    }),
    {
      name: 'solar-auth-storage',
      // Guardar estado completo incluyendo tokens
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
)

// Hook auxiliar para proteger rutas
export function useAuthProtected() {
  const { isAuthenticated, user } = useAuthStore()
  return { isAuthenticated, user }
}

// Hook para verificar permisos
export function usePermissions() {
  const { hasRole, isAdmin, isTechnic } = useAuthStore()
  return { hasRole, isAdmin, isTechnic }
}
