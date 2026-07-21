import api from './api'

export const usuariosService = {
  list: (params = {}) => api.get('/api/usuarios/', { params }),
  get: (id) => api.get(`/api/usuarios/${id}`),
  create: (data) => api.post('/api/usuarios/', data),
  update: (id, data) => api.put(`/api/usuarios/${id}`, data),
  deactivate: (id) => api.patch(`/api/usuarios/${id}/desactivar`),
  delete: (id) => api.delete(`/api/usuarios/${id}`),
  resetPassword: (id, password) => api.patch(`/api/usuarios/${id}/reset-password`, { new_password: password }),
}
