// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import FotoSection from './FotoSection'
import { MODO_FOTOS } from '../utils/plantillas'
import { ORIGEN_FOTO, construirFoto } from '../utils/fotos'

afterEach(cleanup)

const SEC = 'modulos'
const campoCon = (modo) => ({ nombre: 'Limpieza', tipo: 'estado', modo_fotos: modo })

function montar(modo, { fotos = [], onSelect = vi.fn(), onDelete = vi.fn() } = {}) {
  render(
    <FotoSection secId={SEC} campo={campoCon(modo)} fotos={fotos} onSelect={onSelect} onDelete={onDelete} />
  )
  return { onSelect, onDelete }
}

const foto = ({ tipo, id, campo = 'Limpieza', secId = SEC, uploaded = true }) => ({
  ...construirFoto({ secId, campo, tipo, url: `http://x/${id}.webp`, id }),
  uploaded,
})

describe('FotoSection', () => {
  it('no renderiza nada cuando el campo no lleva fotos', () => {
    const { container } = render(
      <FotoSection secId={SEC} campo={campoCon(MODO_FOTOS.NINGUNA)} fotos={[]} onSelect={vi.fn()} onDelete={vi.fn()} />
    )
    expect(container.innerHTML).toBe('')
  })

  describe('modo una foto', () => {
    it('ofrece cámara y galería', () => {
      montar(MODO_FOTOS.UNICA)
      expect(screen.getByRole('button', { name: /cámara/i })).toBeDefined()
      expect(screen.getByRole('button', { name: /galería/i })).toBeDefined()
    })

    it('la cámara pide reemplazar para no acumular fotos', () => {
      const { onSelect } = montar(MODO_FOTOS.UNICA)
      screen.getByRole('button', { name: /cámara/i }).click()
      expect(onSelect).toHaveBeenCalledWith('foto_unica', { reemplazar: true, origen: ORIGEN_FOTO.CAMARA })
    })

    it('la galería también reemplaza y usa su propio origen', () => {
      const { onSelect } = montar(MODO_FOTOS.UNICA)
      screen.getByRole('button', { name: /galería/i }).click()
      expect(onSelect).toHaveBeenCalledWith('foto_unica', { reemplazar: true, origen: ORIGEN_FOTO.GALERIA })
    })

    it('avisa que volver a cargar reemplaza', () => {
      montar(MODO_FOTOS.UNICA, { fotos: [foto({ tipo: 'foto_unica', id: '1' })] })
      expect(screen.getByText(/reemplaza/i)).toBeDefined()
    })
  })

  describe('modo múltiples fotos', () => {
    it('no reemplaza, acumula', () => {
      const { onSelect } = montar(MODO_FOTOS.MULTIPLE)
      screen.getByRole('button', { name: /cámara/i }).click()
      expect(onSelect).toHaveBeenCalledWith('foto_unica', { reemplazar: false, origen: ORIGEN_FOTO.CAMARA })
    })

    it('muestra cuántas fotos hay cargadas', () => {
      montar(MODO_FOTOS.MULTIPLE, {
        fotos: [foto({ tipo: 'foto_unica', id: '1' }), foto({ tipo: 'foto_unica', id: '2' })],
      })
      expect(screen.getByText(/2 fotos cargadas/i)).toBeDefined()
    })

    it('usa el singular con una sola foto', () => {
      montar(MODO_FOTOS.MULTIPLE, { fotos: [foto({ tipo: 'foto_unica', id: '1' })] })
      expect(screen.getByText(/1 foto cargada/i)).toBeDefined()
    })
  })

  describe('modo antes/durante/después', () => {
    it('muestra los tres slots', () => {
      montar(MODO_FOTOS.TRIPLE)
      for (const label of ['Antes', 'Durante', 'Después']) {
        expect(screen.getByText(label)).toBeDefined()
      }
    })

    it('da cámara y galería en cada slot: seis botones', () => {
      montar(MODO_FOTOS.TRIPLE)
      expect(screen.getAllByRole('button', { name: /tomar foto/i })).toHaveLength(3)
      expect(screen.getAllByRole('button', { name: /elegir de galería/i })).toHaveLength(3)
    })

    it.each([
      ['Antes', 'antes'],
      ['Durante', 'durante'],
      ['Después', 'despues'],
    ])('el botón de cámara de %s envía el tipo %s', (label, tipo) => {
      const { onSelect } = montar(MODO_FOTOS.TRIPLE)
      screen.getByRole('button', { name: `${label}: tomar foto` }).click()
      expect(onSelect).toHaveBeenCalledWith(tipo, { origen: ORIGEN_FOTO.CAMARA })
    })

    it('el botón de galería omite la cámara', () => {
      const { onSelect } = montar(MODO_FOTOS.TRIPLE)
      screen.getByRole('button', { name: 'Durante: elegir de galería' }).click()
      expect(onSelect).toHaveBeenCalledWith('durante', { origen: ORIGEN_FOTO.GALERIA })
    })

    it('cada miniatura cae en el slot de su tipo', () => {
      montar(MODO_FOTOS.TRIPLE, {
        fotos: [foto({ tipo: 'antes', id: 'a' }), foto({ tipo: 'despues', id: 'd' })],
      })
      expect(screen.getByAltText('Antes')).toBeDefined()
      expect(screen.getByAltText('Después')).toBeDefined()
      expect(screen.queryByAltText('Durante')).toBeNull()
    })
  })

  describe('miniaturas', () => {
    // Regresión: antes se filtraba con el objeto campo en vez del nombre, la
    // clave quedaba "seccion.[object Object]" y nunca aparecía ninguna foto
    it('muestra las fotos del campo', () => {
      montar(MODO_FOTOS.UNICA, { fotos: [foto({ tipo: 'foto_unica', id: '1' })] })
      expect(screen.getByAltText('foto')).toBeDefined()
    })

    it('ignora las fotos de otro campo de la misma sección', () => {
      montar(MODO_FOTOS.UNICA, { fotos: [foto({ tipo: 'foto_unica', id: '1', campo: 'Otro Campo' })] })
      expect(screen.queryByAltText('foto')).toBeNull()
    })

    it('ignora las fotos del mismo campo en otra sección', () => {
      montar(MODO_FOTOS.UNICA, { fotos: [foto({ tipo: 'foto_unica', id: '1', secId: 'estructura' })] })
      expect(screen.queryByAltText('foto')).toBeNull()
    })

    it('marca como local la foto que todavía no se subió', () => {
      montar(MODO_FOTOS.UNICA, { fotos: [foto({ tipo: 'foto_unica', id: '1', uploaded: false })] })
      expect(screen.getByText('local')).toBeDefined()
    })

    it('no marca local la que ya está subida', () => {
      montar(MODO_FOTOS.UNICA, { fotos: [foto({ tipo: 'foto_unica', id: '1', uploaded: true })] })
      expect(screen.queryByText('local')).toBeNull()
    })

    it('eliminar avisa con el id de esa foto', () => {
      const { onDelete } = montar(MODO_FOTOS.MULTIPLE, {
        fotos: [foto({ tipo: 'foto_unica', id: 'uno' }), foto({ tipo: 'foto_unica', id: 'dos' })],
      })
      const segunda = screen.getAllByAltText('foto')[1].parentElement
      within(segunda).getByRole('button').click()
      expect(onDelete).toHaveBeenCalledWith('dos')
    })
  })
})
