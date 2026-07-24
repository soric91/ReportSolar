// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import {
  ORIGEN_FOTO,
  MAX_LADO_PX,
  crearInputFoto,
  calcularDimensiones,
  construirFoto,
  agregarFoto,
} from './fotos'

describe('crearInputFoto', () => {
  it('acepta imágenes', () => {
    expect(crearInputFoto().accept).toBe('image/*')
    expect(crearInputFoto().type).toBe('file')
  })

  it('fija capture para la cámara, que abre la cámara directo en el celular', () => {
    expect(crearInputFoto({ origen: ORIGEN_FOTO.CAMARA }).getAttribute('capture')).toBe('environment')
  })

  it('omite capture para la galería, si no el celular nunca deja elegir una imagen guardada', () => {
    expect(crearInputFoto({ origen: ORIGEN_FOTO.GALERIA }).hasAttribute('capture')).toBe(false)
  })

  it('usa la cámara por defecto', () => {
    expect(crearInputFoto().getAttribute('capture')).toBe('environment')
  })
})

describe('calcularDimensiones', () => {
  it('no agranda imágenes que ya entran en el máximo', () => {
    expect(calcularDimensiones(800, 600)).toEqual({ width: 800, height: 600 })
  })

  it('deja intacta la imagen que mide exactamente el máximo', () => {
    expect(calcularDimensiones(MAX_LADO_PX, MAX_LADO_PX)).toEqual({ width: MAX_LADO_PX, height: MAX_LADO_PX })
  })

  it('reduce por el ancho cuando es apaisada y mantiene la proporción', () => {
    const { width, height } = calcularDimensiones(3200, 2400)
    expect(width).toBe(MAX_LADO_PX)
    expect(height).toBe(1200)
    expect(width / height).toBeCloseTo(3200 / 2400)
  })

  it('reduce por el alto cuando es vertical y mantiene la proporción', () => {
    const { width, height } = calcularDimensiones(2400, 3200)
    expect(height).toBe(MAX_LADO_PX)
    expect(width).toBe(1200)
    expect(width / height).toBeCloseTo(2400 / 3200)
  })

  it('achica aunque solo un lado pase del máximo', () => {
    const { width, height } = calcularDimensiones(4000, 100)
    expect(width).toBe(MAX_LADO_PX)
    expect(height).toBeLessThan(100)
  })
})

describe('construirFoto', () => {
  it('arma el checklist_item como seccion.campo', () => {
    const foto = construirFoto({ secId: 'modulos', campo: 'Limpieza', tipo: 'antes', url: 'data:x' })
    expect(foto.checklist_item).toBe('modulos.Limpieza')
  })

  it('nace sin subir y con el dataUrl para poder reintentar', () => {
    const foto = construirFoto({ secId: 'modulos', campo: 'Limpieza', tipo: 'antes', url: 'data:x' })
    expect(foto.uploaded).toBe(false)
    expect(foto.dataUrl).toBe('data:x')
  })
})

describe('agregarFoto', () => {
  const antes = construirFoto({ secId: 's', campo: 'c', tipo: 'antes', url: 'a', id: '1' })
  const otraAntes = construirFoto({ secId: 's', campo: 'c', tipo: 'antes', url: 'b', id: '2' })
  const despues = construirFoto({ secId: 's', campo: 'c', tipo: 'despues', url: 'c', id: '3' })
  const otroCampo = construirFoto({ secId: 's', campo: 'otro', tipo: 'antes', url: 'd', id: '4' })

  it('acumula cuando el campo admite varias fotos', () => {
    const res = agregarFoto([antes], otraAntes)
    expect(res.map(f => f.id)).toEqual(['1', '2'])
  })

  it('reemplaza la anterior cuando el campo admite una sola', () => {
    const res = agregarFoto([antes], otraAntes, { reemplazar: true })
    expect(res.map(f => f.id)).toEqual(['2'])
  })

  it('al reemplazar no toca las fotos de otro tipo del mismo campo', () => {
    const res = agregarFoto([antes, despues], otraAntes, { reemplazar: true })
    expect(res.map(f => f.id).sort()).toEqual(['2', '3'])
  })

  it('al reemplazar no toca las fotos de otros campos', () => {
    const res = agregarFoto([antes, otroCampo], otraAntes, { reemplazar: true })
    expect(res.map(f => f.id).sort()).toEqual(['2', '4'])
  })

  it('no muta la lista original', () => {
    const original = [antes]
    agregarFoto(original, otraAntes, { reemplazar: true })
    expect(original).toEqual([antes])
  })

  it('funciona sobre una lista vacía', () => {
    expect(agregarFoto([], antes, { reemplazar: true })).toEqual([antes])
  })
})
