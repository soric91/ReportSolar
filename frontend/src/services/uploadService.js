import api from './api'

export const uploadService = {
  async uploadFoto({ projectName, projectId, checklistItem, tipo, dataUrl }) {
    const response = await api.post('/api/reportes/upload-foto', {
      proyecto_nombre: projectName,
      proyecto_id: projectId,
      checklist_item: checklistItem,
      tipo,
      imagen: dataUrl,
    })
    return response.data
  },
}
