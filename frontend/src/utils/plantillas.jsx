import api from '../services/api'

export const DEFAULT_COLORES = {
  primario: '#c86400',
  secundario: '#fac896',
  texto: '#323232',
  fondo: '#fafafa',
}

export const ESTADOS = [
  { key: 'ok', label: 'OK', color: 'bg-green-100 text-green-700 border-green-300' },
  { key: 'atencion', label: 'Atención', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { key: 'reparado', label: 'Reparado', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { key: 'na', label: 'N/A', color: 'bg-gray-100 text-gray-500 border-gray-300' },
]

// Modo de fotos explícito por campo. Antes se infería de los flags sueltos
// (sin_fotos / foto_unica / foto_requerida), lo que daba resultados distintos
// según el tipo de campo y según qué flags hubieran quedado de ediciones previas.
export const MODO_FOTOS = {
  NINGUNA: 'ninguna',
  UNICA: 'unica',
  TRIPLE: 'triple',
}

export const MODO_FOTOS_OPCIONES = [
  { value: MODO_FOTOS.NINGUNA, label: 'Sin fotos' },
  { value: MODO_FOTOS.UNICA, label: 'Una foto' },
  { value: MODO_FOTOS.TRIPLE, label: 'Antes/Durante/Después' },
]

/**
 * Devuelve el modo de fotos de un campo. Si la plantilla es anterior al
 * selector explícito, lo deduce de los flags viejos.
 */
export function getModoFotos(campo) {
  if (campo?.modo_fotos) return campo.modo_fotos
  if (campo?.sin_fotos) return MODO_FOTOS.NINGUNA
  if (campo?.foto_requerida && campo?.tipo !== 'numero') return MODO_FOTOS.TRIPLE
  if (campo?.foto_unica || campo?.tipo === 'numero') return MODO_FOTOS.UNICA
  return MODO_FOTOS.NINGUNA
}

/**
 * Flags a persistir para un modo dado. Mantiene sincronizados los campos
 * heredados porque el generador de DOCX del backend todavía lee `sin_fotos`.
 */
export function flagsParaModoFotos(modo) {
  return {
    modo_fotos: modo,
    sin_fotos: modo === MODO_FOTOS.NINGUNA,
    foto_unica: modo === MODO_FOTOS.UNICA,
    foto_requerida: modo === MODO_FOTOS.TRIPLE,
  }
}

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
        const merged = {
          ...defaultCampo,
          ...campo,
          tipo: campo.tipo || defaultCampo?.tipo, // Respeta el tipo elegido en la plantilla
        }
        // Normaliza el modo de fotos para que el checklist no tenga que inferirlo
        return { ...merged, ...flagsParaModoFotos(getModoFotos(merged)) }
      })
    }
  })
}
