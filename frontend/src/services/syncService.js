import api from './api'
import { db } from './db'

const SYNC_KEY = 'solar-pending-sync'
const SYNC_STATUS_KEY = 'solar-sync-status'

export const syncService = {
  getPendingCount() {
    const pending = JSON.parse(localStorage.getItem(SYNC_KEY) || '[]')
    return pending.length
  },

  addToPending(item) {
    const pending = JSON.parse(localStorage.getItem(SYNC_KEY) || '[]')
    const newItem = { ...item, local_id: Date.now(), _timestamp: new Date().toISOString() }

    if (item.reporte_id) {
      const idx = pending.findIndex(p => p.reporte_id === item.reporte_id)
      if (idx >= 0) {
        pending[idx] = newItem
      } else {
        pending.push(newItem)
      }
    } else {
      const idx = pending.findIndex(p => !p.reporte_id && p.proyecto_id === item.proyecto_id && p.reporte_estado === 'borrador')
      if (idx >= 0) {
        pending[idx] = newItem
      } else {
        pending.push(newItem)
      }
    }

    localStorage.setItem(SYNC_KEY, JSON.stringify(pending))
  },

  getPending() {
    return JSON.parse(localStorage.getItem(SYNC_KEY) || '[]')
  },

  clearPending() {
    localStorage.setItem(SYNC_KEY, '[]')
  },

  async syncAll() {
    const pending = this.getPending()
    console.log('🔄 Pendientes a sincronizar:', pending.length, pending)
    if (pending.length === 0) return { sincronizados: 0, conflictos: 0, detalles: [] }

    try {
      console.log('📡 Enviando a /api/sync/batch:', { visitas: pending })
      const response = await api.post('/api/sync/batch', { visitas: pending })
      const result = response.data
      console.log('✅ Respuesta del servidor:', result)

      const successfulLocalIds = result.detalles
        .filter(d => d.status === 'ok')
        .map(d => d.local_id)
      const remaining = pending.filter(p => !successfulLocalIds.includes(p.local_id))
      localStorage.setItem(SYNC_KEY, JSON.stringify(remaining))

      localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify({
        lastSync: new Date().toISOString(),
        pending: this.getPendingCount(),
      }))

      return result
    } catch (error) {
      console.error('❌ Error en syncAll:', error.response?.data || error.message)
      return {
        sincronizados: 0,
        conflictos: pending.length,
        error: error.response?.data?.detail || error.message,
        detalles: []
      }
    }
  },

  getLastSync() {
    return JSON.parse(localStorage.getItem(SYNC_STATUS_KEY) || '{}')
  },

  async syncProyectos() {
    try {
      const response = await api.get('/api/sync/proyectos')
      if (response.data?.proyectos) {
        await db.saveProyectos(response.data.proyectos)
        return { success: true, count: response.data.proyectos.length }
      }
      return { success: false, error: 'No proyectos en respuesta' }
    } catch (error) {
      console.error('Error sincronizando proyectos:', error)
      const proyectos = await db.getProyectos()
      return { success: false, offline: true, count: proyectos.length, error: error.message }
    }
  },
}
