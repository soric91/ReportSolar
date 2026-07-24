import { describe, it, expect } from 'vitest'
import {
  MODO_FOTOS,
  getModoFotos,
  flagsParaModoFotos,
  mergeSeccionesWithDefaults,
} from './plantillas'

describe('getModoFotos', () => {
  it('usa el modo explícito cuando existe', () => {
    expect(getModoFotos({ tipo: 'texto', modo_fotos: MODO_FOTOS.TRIPLE })).toBe(MODO_FOTOS.TRIPLE)
    expect(getModoFotos({ tipo: 'numero', modo_fotos: MODO_FOTOS.MULTIPLE })).toBe(MODO_FOTOS.MULTIPLE)
  })

  it('el modo explícito le gana a los flags heredados', () => {
    const campo = { tipo: 'estado', foto_requerida: true, modo_fotos: MODO_FOTOS.NINGUNA }
    expect(getModoFotos(campo)).toBe(MODO_FOTOS.NINGUNA)
  })

  // Compatibilidad: plantillas guardadas antes de que el modo fuera explícito
  describe('plantillas heredadas', () => {
    it('campo de estado con foto_requerida sigue pidiendo antes/durante/después', () => {
      expect(getModoFotos({ tipo: 'estado', foto_requerida: true })).toBe(MODO_FOTOS.TRIPLE)
    })

    it('sin_fotos gana sobre cualquier otro flag', () => {
      expect(getModoFotos({ tipo: 'estado', sin_fotos: true, foto_requerida: true })).toBe(MODO_FOTOS.NINGUNA)
    })

    it('campo numérico que pide foto resuelve a una sola', () => {
      expect(getModoFotos({ tipo: 'numero', sin_fotos: false })).toBe(MODO_FOTOS.UNICA)
    })

    it('foto_requerida en un numérico no fuerza el modo triple', () => {
      // Caso real: el campo era "estado", lo cambiaron a "numero" y el flag quedó pegado
      expect(getModoFotos({ tipo: 'numero', foto_requerida: true })).toBe(MODO_FOTOS.UNICA)
    })

    it('campo de texto sin flags de foto no muestra fotos', () => {
      expect(getModoFotos({ tipo: 'texto' })).toBe(MODO_FOTOS.NINGUNA)
    })
  })
})

describe('flagsParaModoFotos', () => {
  it('mantiene sin_fotos coherente para el generador de DOCX del backend', () => {
    expect(flagsParaModoFotos(MODO_FOTOS.NINGUNA).sin_fotos).toBe(true)
    expect(flagsParaModoFotos(MODO_FOTOS.UNICA).sin_fotos).toBe(false)
    expect(flagsParaModoFotos(MODO_FOTOS.MULTIPLE).sin_fotos).toBe(false)
    expect(flagsParaModoFotos(MODO_FOTOS.TRIPLE).sin_fotos).toBe(false)
  })

  it('solo el modo triple marca foto_requerida', () => {
    expect(flagsParaModoFotos(MODO_FOTOS.TRIPLE).foto_requerida).toBe(true)
    expect(flagsParaModoFotos(MODO_FOTOS.MULTIPLE).foto_requerida).toBe(false)
  })

  it('cada modo sobrevive al ida y vuelta por los flags', () => {
    for (const modo of Object.values(MODO_FOTOS)) {
      expect(getModoFotos({ tipo: 'texto', ...flagsParaModoFotos(modo) })).toBe(modo)
    }
  })
})

describe('mergeSeccionesWithDefaults', () => {
  const defaults = [
    {
      id: 'modulos',
      titulo: 'Módulos',
      icono: '☀️',
      campos: [{ nombre: 'Limpieza', tipo: 'estado', foto_requerida: true }],
    },
  ]

  it('respeta el tipo y el modo elegidos en la plantilla por encima del default', () => {
    const guardada = [{ id: 'modulos', campos: [{ nombre: 'Limpieza', tipo: 'numero', modo_fotos: MODO_FOTOS.UNICA }] }]
    const campo = mergeSeccionesWithDefaults(guardada, defaults)[0].campos[0]
    expect(campo.tipo).toBe('numero')
    expect(campo.modo_fotos).toBe(MODO_FOTOS.UNICA)
  })

  it('completa título e icono desde el default', () => {
    const guardada = [{ id: 'modulos', campos: [] }]
    const sec = mergeSeccionesWithDefaults(guardada, defaults)[0]
    expect(sec.titulo).toBe('Módulos')
    expect(sec.icono).toBe('☀️')
  })

  it('normaliza el modo de campos heredados que no lo tienen', () => {
    const guardada = [{ id: 'modulos', campos: [{ nombre: 'Limpieza' }] }]
    const campo = mergeSeccionesWithDefaults(guardada, defaults)[0].campos[0]
    expect(campo.modo_fotos).toBe(MODO_FOTOS.TRIPLE)
  })
})
