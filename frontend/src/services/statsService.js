import api from './api'

export const statsService = {
  getDashboard: () => api.get('/api/stats/dashboard'),
}
