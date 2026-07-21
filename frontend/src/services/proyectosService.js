import api from './api'

export const proyectosService = {
  list: (params = {}) => api.get('/api/proyectos/', { params }),
  get: (id) => api.get(`/api/proyectos/${id}`),
  create: (data) => api.post('/api/proyectos/', data),
  update: (id, data) => api.put(`/api/proyectos/${id}`, data),
  delete: (id) => api.delete(`/api/proyectos/${id}`),
  asignarTecnico: (proyectoId, tecnicoId) =>
    api.post(`/api/proyectos/${proyectoId}/asignar-tecnico?tecnico_id=${tecnicoId}`),
  desasignarTecnico: (proyectoId, tecnicoId) =>
    api.delete(`/api/proyectos/${proyectoId}/desasignar-tecnico/${tecnicoId}`),
}
