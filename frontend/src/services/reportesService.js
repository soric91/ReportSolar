import api from './api'

export const reportesService = {
  list: (params = {}) => api.get('/api/reportes/', { params }),
  get: (id) => api.get(`/api/reportes/${id}`),
  create: (data) => api.post('/api/reportes/', data),
  update: (id, data) => api.put(`/api/reportes/${id}`, data),
  delete: (id) => api.delete(`/api/reportes/${id}`),
}
