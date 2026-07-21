import api from './api'

export const plantillasService = {
  list: () => api.get('/api/plantillas/'),
  create: (data) => api.post('/api/plantillas/', data),
  update: (id, data) => api.put(`/api/plantillas/${id}`, data),
  delete: (id) => api.delete(`/api/plantillas/${id}`),
}
