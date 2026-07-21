import api from '../services/api'

export const DEFAULT_COLORES = {
  primario: '#0284c7',
  secundario: '#f0f9ff',
  texto: '#1f2937',
  fondo: '#ffffff',
}

export const ESTADOS = [
  { key: 'ok', label: 'OK', color: 'bg-green-100 text-green-700 border-green-300' },
  { key: 'atencion', label: 'Atención', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { key: 'reparado', label: 'Reparado', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { key: 'na', label: 'N/A', color: 'bg-gray-100 text-gray-500 border-gray-300' },
]

let _defaultSeccionesCache = null

export async function loadDefaultSecciones() {
  if (_defaultSeccionesCache) return _defaultSeccionesCache
  try {
    const res = await api.get('/api/plantillas/default-secciones')
    _defaultSeccionesCache = res.data.secciones
  } catch {
    _defaultSeccionesCache = []
  }
  return _defaultSeccionesCache
}

export function getDefaultSeccionesSync() {
  return _defaultSeccionesCache || []
}

export function mergeSeccionesWithDefaults(dbSecciones, defaults) {
  const defaultList = defaults || _defaultSeccionesCache || []
  const defaultMap = {}
  defaultList.forEach(sec => {
    defaultMap[sec.id] = sec
    sec.campos.forEach(campo => {
      defaultMap[`${sec.id}.${campo.nombre}`] = campo
    })
  })

  return dbSecciones.map(sec => {
    const defaultSec = defaultMap[sec.id]
    return {
      ...sec,
      titulo: sec.titulo || defaultSec?.titulo,
      icono: sec.icono || defaultSec?.icono,
      campos: (sec.campos || []).map(campo => {
        const defaultCampo = defaultMap[`${sec.id}.${campo.nombre}`]
        // Prioriza el tipo del default si existe, ignora tipos incorrectos guardados
        return {
          ...defaultCampo,
          ...campo,
          tipo: defaultCampo?.tipo || campo.tipo, // Siempre usa tipo del default
          sin_fotos: campo.sin_fotos ?? defaultCampo?.sin_fotos ?? false,
          foto_unica: campo.foto_unica ?? defaultCampo?.foto_unica ?? false,
        }
      })
    }
  })
}
