import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { proyectosService } from '../services/proyectosService'
import { usuariosService } from '../services/usuariosService'
import { plantillasService } from '../services/plantillasService'
import Modal from '../components/Modal'

export default function ProyectosPage() {
  const [proyectos, setProyectos] = useState([])
  const [tecnicos, setTecnicos] = useState([])
  const [plantillas, setPlantillas] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showAsignar, setShowAsignar] = useState(false)
  const [asignarProyectoId, setAsignarProyectoId] = useState(null)
  const [form, setForm] = useState({ nombre: '', cliente: '', direccion: '', tipo_sistema: 'on_grid', componentes: {}, plantilla_id: null, tecnicos_ids: [] })
  const [error, setError] = useState('')
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'alert' })

  const loadData = async () => {
    try {
      const [proyRes, tecRes, plantRes] = await Promise.all([
        proyectosService.list(),
        usuariosService.list({ rol: 'tecnico' }),
        plantillasService.list(),
      ])
      // Manejar respuestas paginadas
      const proyectos = proyRes.data?.data || proyRes.data
      const tecnicos = tecRes.data?.data || tecRes.data
      const plantillas = plantRes.data?.data || plantRes.data
      setProyectos(Array.isArray(proyectos) ? proyectos : [])
      setTecnicos(Array.isArray(tecnicos) ? tecnicos : [])
      setPlantillas(Array.isArray(plantillas) ? plantillas : [])
    } catch (err) {
      setError('Error al cargar datos')
      setProyectos([])
      setTecnicos([])
      setPlantillas([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ nombre: '', cliente: '', direccion: '', tipo_sistema: 'on_grid', componentes: {}, plantilla_id: null, tecnicos_ids: [] })
    setShowModal(true)
  }

  const openEdit = (p) => {
    setEditing(p)
    setForm({ nombre: p.nombre, cliente: p.cliente, direccion: p.direccion, tipo_sistema: p.tipo_sistema, componentes: p.componentes || {}, plantilla_id: p.plantilla_id || null, tecnicos_ids: p.tecnicos?.map(t => t.id) || [] })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      if (editing) {
        await proyectosService.update(editing.id, form)
      } else {
        await proyectosService.create(form)
      }
      setShowModal(false)
      loadData()
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al guardar')
    }
  }

  const handleDelete = async (id) => {
    setModal({
      isOpen: true,
      title: 'Eliminar proyecto',
      message: '¿Estás seguro que deseas eliminar este proyecto?',
      type: 'confirm',
      onConfirm: async () => {
        try {
          await proyectosService.delete(id)
          loadData()
        } catch (err) {
          setError(err.response?.data?.detail || 'Error al eliminar')
        }
      }
    })
  }

  const handleAsignar = async (tecnicoId) => {
    try {
      await proyectosService.asignarTecnico(asignarProyectoId, tecnicoId)
      loadData()
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al asignar')
    }
  }

  const handleDesasignar = async (proyectoId, tecnicoId) => {
    try {
      await proyectosService.desasignarTecnico(proyectoId, tecnicoId)
      loadData()
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al desasignar')
    }
  }

  const toggleTecnico = (tecnicoId) => {
    const current = form.tecnicos_ids || []
    const updated = current.includes(tecnicoId)
      ? current.filter(id => id !== tecnicoId)
      : [...current, tecnicoId]
    setForm({ ...form, tecnicos_ids: updated })
  }

  if (loading) return <div className="text-center py-8">Cargando...</div>

  const tipoLabels = { on_grid: 'On-Grid', off_grid: 'Off-Grid', hibrido: 'Híbrido' }

  return (
    <div>
      <div className="flex justify-between items-center mb-4 lg:mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-800">Proyectos</h1>
        <button onClick={openCreate} className="px-3 py-2 lg:px-4 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm">
          + Nuevo
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm">{error}</div>}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 lg:px-4 py-2 lg:py-3 font-medium text-gray-600 text-xs lg:text-sm">Proyecto</th>
                <th className="text-left px-3 lg:px-4 py-2 lg:py-3 font-medium text-gray-600 text-xs lg:text-sm hidden sm:table-cell">Cliente</th>
                <th className="text-left px-3 lg:px-4 py-2 lg:py-3 font-medium text-gray-600 text-xs lg:text-sm">Tipo</th>
                <th className="text-left px-3 lg:px-4 py-2 lg:py-3 font-medium text-gray-600 text-xs lg:text-sm hidden md:table-cell">Plantilla</th>
                <th className="text-left px-3 lg:px-4 py-2 lg:py-3 font-medium text-gray-600 text-xs lg:text-sm">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {proyectos.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-3 lg:px-4 py-2 lg:py-3">
                    <div className="font-medium text-xs lg:text-sm">{p.nombre}</div>
                    <div className="text-xs text-gray-500 sm:hidden">{p.cliente}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(p.tecnicos || []).map((t) => (
                        <span key={t.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 rounded text-xs">
                          {t.nombre}
                          <button onClick={() => handleDesasignar(p.id, t.id)} className="text-red-400 hover:text-red-600">×</button>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 lg:px-4 py-2 lg:py-3 text-gray-600 text-xs lg:text-sm hidden sm:table-cell">{p.cliente}</td>
                  <td className="px-3 lg:px-4 py-2 lg:py-3">
                    <span className="px-2 py-1 rounded-full text-xs bg-primary-100 text-primary-700">{tipoLabels[p.tipo_sistema]}</span>
                  </td>
                  <td className="px-3 lg:px-4 py-2 lg:py-3 hidden md:table-cell">
                    {p.plantilla_nombre ? (
                      <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">{p.plantilla_nombre}</span>
                    ) : (
                      <span className="text-xs text-gray-400">Sin plantilla</span>
                    )}
                  </td>
                  <td className="px-3 lg:px-4 py-2 lg:py-3">
                    <div className="flex flex-col gap-1">
                      <button onClick={() => { setAsignarProyectoId(p.id); setShowAsignar(true) }} className="text-primary-600 hover:text-primary-800 text-xs">+Técnico</button>
                      <button onClick={() => openEdit(p)} className="text-primary-600 hover:text-primary-800 text-xs">Editar</button>
                      <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:text-red-800 text-xs">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
              {proyectos.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Sin proyectos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-xl sm:rounded-lg w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <h2 className="text-lg font-bold mb-4">{editing ? 'Editar Proyecto' : 'Nuevo Proyecto'}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input type="text" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                  <input type="text" value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                  <input type="text" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de sistema</label>
                  <select value={form.tipo_sistema} onChange={(e) => setForm({ ...form, tipo_sistema: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm">
                    <option value="on_grid">On-Grid</option>
                    <option value="off_grid">Off-Grid</option>
                    <option value="hibrido">Híbrido</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plantilla de Informe</label>
                  {plantillas.length === 0 ? (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                      <span className="text-amber-600 text-sm">No hay plantillas creadas.</span>
                      <Link to="/plantillas" className="text-sm text-primary-600 hover:text-primary-800 font-medium underline">Crear plantilla</Link>
                    </div>
                  ) : (
                    <select value={form.plantilla_id || ''} onChange={(e) => setForm({ ...form, plantilla_id: e.target.value || null })} className="w-full px-3 py-2 border rounded-md text-sm">
                      <option value="">Sin plantilla</option>
                      {plantillas.map((p) => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Técnicos Asignados</label>
                  <div className="border border-gray-200 rounded-md max-h-40 overflow-y-auto">
                    {tecnicos.filter(t => t.estado === 'activo').length === 0 ? (
                      <p className="px-3 py-2 text-xs text-gray-400">No hay técnicos activos</p>
                    ) : (
                      tecnicos.filter(t => t.estado === 'activo').map((t) => (
                        <label key={t.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0">
                          <input
                            type="checkbox"
                            checked={(form.tecnicos_ids || []).includes(t.id)}
                            onChange={() => toggleTecnico(t.id)}
                            className="rounded text-primary-600"
                          />
                          <div className="flex-1">
                            <span className="text-sm">{t.nombre}</span>
                            <span className="text-xs text-gray-500 ml-2">{t.email}</span>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                  {(form.tecnicos_ids || []).length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">{(form.tecnicos_ids || []).length} técnico(s) seleccionado(s)</p>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm">Cancelar</button>
                  <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm">Guardar</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showAsignar && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-xl sm:rounded-lg w-full sm:max-w-md">
            <div className="p-4 sm:p-6">
              <h2 className="text-lg font-bold mb-4">Asignar Técnico</h2>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {tecnicos.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { handleAsignar(t.id); setShowAsignar(false) }}
                    className="w-full text-left px-4 py-3 rounded-md hover:bg-gray-100 flex justify-between items-center"
                  >
                    <div>
                      <div className="font-medium text-sm">{t.nombre}</div>
                      <div className="text-xs text-gray-500">{t.email}</div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${t.estado === 'activo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {t.estado}
                    </span>
                  </button>
                ))}
                {tecnicos.length === 0 && <p className="text-center text-gray-400 text-sm">No hay técnicos</p>}
              </div>
              <button onClick={() => setShowAsignar(false)} className="mt-4 w-full py-2 text-gray-600 hover:text-gray-800 text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        confirmText="Eliminar"
        onClose={() => setModal({ ...modal, isOpen: false })}
        onConfirm={modal.onConfirm}
      />
    </div>
  )
}
