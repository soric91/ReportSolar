export const ORIGEN_FOTO = {
  CAMARA: 'camara',
  GALERIA: 'galeria',
}

// Lado más largo al que se reduce la imagen antes de guardarla
export const MAX_LADO_PX = 1600

/**
 * Crea el input de archivo con el que se carga una foto.
 *
 * `capture` solo se aplica al origen cámara: en el celular ese atributo abre
 * la cámara directo y nunca deja llegar a la galería, así que para el origen
 * galería hay que omitirlo para que el sistema muestre su selector.
 */
export function crearInputFoto({ origen = ORIGEN_FOTO.CAMARA } = {}) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  // setAttribute y no `input.capture = ...`: la propiedad IDL no se refleja
  // como atributo en todos los entornos, el atributo sí funciona en todos
  if (origen === ORIGEN_FOTO.CAMARA) input.setAttribute('capture', 'environment')
  return input
}

/**
 * Dimensiones reducidas para que el lado más largo no supere `max`,
 * manteniendo la proporción. Las imágenes más chicas no se tocan.
 */
export function calcularDimensiones(width, height, max = MAX_LADO_PX) {
  if (width <= max && height <= max) return { width, height }
  return width > height
    ? { width: max, height: (height / width) * max }
    : { width: (width / height) * max, height: max }
}

export function construirFoto({ secId, campo, tipo, url, id }) {
  const checklistItem = `${secId}.${campo}`
  return {
    id: id ?? `${checklistItem}_${tipo}_${Date.now()}`,
    url,
    checklist_item: checklistItem,
    tipo,
    dataUrl: url,
    uploaded: false,
  }
}

/**
 * Agrega una foto a la lista. Con `reemplazar` (campos de una sola foto)
 * descarta las que ya había para ese mismo ítem y tipo; si no, acumula.
 */
export function agregarFoto(fotos, nueva, { reemplazar = false } = {}) {
  const base = reemplazar
    ? fotos.filter(f => !(f.checklist_item === nueva.checklist_item && f.tipo === nueva.tipo))
    : fotos
  return [...base, nueva]
}
