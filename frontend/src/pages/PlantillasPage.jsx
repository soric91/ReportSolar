import { useState, useEffect } from 'react'
import { plantillasService } from '../services/plantillasService'
import { loadDefaultSecciones, getDefaultSeccionesSync, DEFAULT_COLORES } from '../utils/plantillas'
import Modal from '../components/Modal'

export default function PlantillasPage() {
  const [plantillas, setPlantillas] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showEditor, setShowEditor] = useState(false)
  const [selectedPlantilla, setSelectedPlantilla] = useState(null)
  const [form, setForm] = useState({ nombre: '', descripcion: '', secciones: [], colores: DEFAULT_COLORES })
  const [error, setError] = useState('')
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'alert' })

  const loadPlantillas = async () => {
    try {
      await loadDefaultSecciones()
      const res = await plantillasService.list()
      // Manejar respuesta paginada
      const data = res.data?.data || res.data
      setPlantillas(Array.isArray(data) ? data : [])
    } catch (err) {
      setError('Error al cargar plantillas')
      setPlantillas([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadPlantillas() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ nombre: '', descripcion: '', secciones: getDefaultSeccionesSync(), colores: { ...DEFAULT_COLORES } })
    setShowModal(true)
  }

  const openEdit = (p) => {
    setEditing(p)
    setForm({
      nombre: p.nombre,
      descripcion: p.descripcion,
      secciones: JSON.parse(JSON.stringify(p.secciones || getDefaultSeccionesSync())),
      colores: { ...(p.colores || DEFAULT_COLORES) },
    })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      if (editing) {
        await plantillasService.update(editing.id, form)
      } else {
        await plantillasService.create(form)
      }
      setShowModal(false)
      loadPlantillas()
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al guardar')
    }
  }

  const handleDelete = async (id) => {
    setModal({
      isOpen: true,
      title: 'Eliminar plantilla',
      message: '¿Estás seguro que deseas eliminar esta plantilla?',
      type: 'confirm',
      onConfirm: async () => {
        try {
          await plantillasService.delete(id)
          loadPlantillas()
        } catch (err) {
          setError(err.response?.data?.detail || 'Error al eliminar')
        }
      }
    })
  }

  const addSeccion = () => {
    setForm({ ...form, secciones: [...form.secciones, { id: `seccion_${Date.now()}`, titulo: 'Nueva Sección', icono: '📋', campos: [] }] })
  }

  const removeSeccion = (idx) => {
    setForm({ ...form, secciones: form.secciones.filter((_, i) => i !== idx) })
  }

  const updateSeccion = (idx, field, value) => {
    const updated = [...form.secciones]
    updated[idx] = { ...updated[idx], [field]: value }
    setForm({ ...form, secciones: updated })
  }

  const addCampo = (seccionIdx) => {
    const updated = [...form.secciones]
    updated[seccionIdx].campos = [...updated[seccionIdx].campos, { nombre: 'Nuevo Campo', tipo: 'estado', foto_unica: true }]
    setForm({ ...form, secciones: updated })
  }

  const addCampoGrupoStrings = (seccionIdx) => {
    const updated = [...form.secciones]
    updated[seccionIdx].campos = [...updated[seccionIdx].campos, {
      nombre: 'Voltajes por String',
      tipo: 'grupo_strings',
      strings_por_inversor: 6,
      notas: true
    }]
    setForm({ ...form, secciones: updated })
  }

  const addCampoGrupoVoltajes = (seccionIdx) => {
    const updated = [...form.secciones]
    updated[seccionIdx].campos = [...updated[seccionIdx].campos, {
      nombre: 'Grupo de Voltajes',
      tipo: 'grupo_voltajes',
      sub_campos: [
        { nombre: 'Voltaje 1 (V)', tipo: 'ac', placeholder: 'V' },
        { nombre: 'Voltaje 2 (V)', tipo: 'ac', placeholder: 'V' }
      ],
      notas: true
    }]
    setForm({ ...form, secciones: updated })
  }

  const addSubCampo = (seccionIdx, campoIdx) => {
    const updated = [...form.secciones]
    const campo = updated[seccionIdx].campos[campoIdx]
    if (!campo.sub_campos) campo.sub_campos = []
    campo.sub_campos = [...campo.sub_campos, { nombre: 'Nuevo Voltaje (V)', tipo: 'ac', placeholder: 'V' }]
    setForm({ ...form, secciones: updated })
  }

  const removeSubCampo = (seccionIdx, campoIdx, subIdx) => {
    const updated = [...form.secciones]
    updated[seccionIdx].campos[campoIdx].sub_campos = updated[seccionIdx].campos[campoIdx].sub_campos.filter((_, i) => i !== subIdx)
    setForm({ ...form, secciones: updated })
  }

  const updateSubCampo = (seccionIdx, campoIdx, subIdx, field, value) => {
    const updated = [...form.secciones]
    updated[seccionIdx].campos[campoIdx].sub_campos[subIdx] = {
      ...updated[seccionIdx].campos[campoIdx].sub_campos[subIdx],
      [field]: value
    }
    setForm({ ...form, secciones: updated })
  }

  const removeCampo = (seccionIdx, campoIdx) => {
    const updated = [...form.secciones]
    updated[seccionIdx].campos = updated[seccionIdx].campos.filter((_, i) => i !== campoIdx)
    setForm({ ...form, secciones: updated })
  }

  const updateCampo = (seccionIdx, campoIdx, field, value) => {
    const updated = [...form.secciones]
    updated[seccionIdx].campos[campoIdx] = { ...updated[seccionIdx].campos[campoIdx], [field]: value }
    setForm({ ...form, secciones: updated })
  }

  const getPhotoConfig = (tipo) => {
    if (tipo === 'estado') return { key: 'foto_unica', label: 'Foto única', defaultVal: true }
    if (['texto', 'numero', 'textarea', 'fecha'].includes(tipo)) return { key: 'sin_fotos', label: 'Sin fotos', defaultVal: false }
    return null
  }

  if (loading) return <div className="text-center py-8">Cargando...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-4 lg:mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-800">Plantillas de Informe</h1>
        <button onClick={openCreate} className="px-3 py-2 lg:px-4 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm">+ Nueva</button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {plantillas.map((p) => (
          <div key={p.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: p.colores?.primario || '#0284c7' }}>
                  📄
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-gray-800">{p.nombre}</h3>
                  <p className="text-xs text-gray-500">{p.secciones?.length || 0} secciones</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-3 line-clamp-2">{p.descripcion || 'Sin descripción'}</p>
            <div className="flex gap-2">
              <button onClick={() => openEdit(p)} className="flex-1 py-2 text-xs text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50">Editar</button>
              <button onClick={() => { setSelectedPlantilla(p); setShowEditor(true) }} className="flex-1 py-2 text-xs text-green-600 border border-green-200 rounded-lg hover:bg-green-50">Vista Previa</button>
              <button onClick={() => handleDelete(p.id)} className="py-2 px-3 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50">🗑</button>
            </div>
          </div>
        ))}
        {plantillas.length === 0 && (
          <div className="col-span-full bg-white rounded-lg shadow p-8 text-center text-gray-400 text-sm">
            Sin plantillas creadas
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-xl sm:rounded-lg w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <h2 className="text-lg font-bold mb-4">{editing ? 'Editar Plantilla' : 'Nueva Plantilla'}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input type="text" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                  <textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" rows={2} />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">Secciones del Informe</label>
                    <button type="button" onClick={addSeccion} className="text-xs text-primary-600 hover:text-primary-800">+ Sección</button>
                  </div>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {form.secciones.map((seccion, si) => (
                      <div key={si} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <input type="text" value={seccion.icono} onChange={(e) => updateSeccion(si, 'icono', e.target.value)} className="w-10 text-center border rounded text-sm" />
                          <input type="text" value={seccion.titulo} onChange={(e) => updateSeccion(si, 'titulo', e.target.value)} className="flex-1 px-2 py-1 border rounded text-sm" />
                          <button type="button" onClick={() => removeSeccion(si)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                        </div>
                        <div className="space-y-2 ml-8">
                          {seccion.campos.map((campo, ci) => (
                            <div key={ci} className="border border-gray-100 rounded p-2">
                              <div className="flex items-center gap-2">
                                <input type="text" value={campo.nombre} onChange={(e) => updateCampo(si, ci, 'nombre', e.target.value)} className="flex-1 px-2 py-1 border rounded text-xs" />
                                <select value={campo.tipo} onChange={(e) => updateCampo(si, ci, 'tipo', e.target.value)} className="px-2 py-1 border rounded text-xs">
                                  <option value="texto">Texto</option>
                                  <option value="numero">Número</option>
                                  <option value="estado">Estado</option>
                                  <option value="fecha">Fecha</option>
                                  <option value="textarea">Textarea</option>
                                  <option value="grupo_strings">Grupo Strings</option>
                                  <option value="grupo_voltajes">Grupo Voltajes</option>
                                </select>
                                <button type="button" onClick={() => removeCampo(si, ci)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                              </div>

                              {campo.tipo === 'grupo_strings' && (
                                <div className="mt-2 pl-2 border-l-2 border-primary-200">
                                  <div className="flex items-center gap-2 mb-1">
                                    <label className="text-xs text-gray-500">Strings por inversor:</label>
                                    <input type="number" value={campo.strings_por_inversor || 6} onChange={(e) => updateCampo(si, ci, 'strings_por_inversor', parseInt(e.target.value) || 6)} className="w-16 px-2 py-1 border rounded text-xs" min="1" max="24" />
                                  </div>
                                  <label className="flex items-center gap-1 text-xs text-gray-500">
                                    <input type="checkbox" checked={campo.notas !== false} onChange={(e) => updateCampo(si, ci, 'notas', e.target.checked)} className="rounded" />
                                    Incluir notas
                                  </label>
                                </div>
                              )}

                              {campo.tipo === 'grupo_voltajes' && (
                                <div className="mt-2 pl-2 border-l-2 border-green-200">
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs text-gray-500">Sub-campos:</label>
                                    <button type="button" onClick={() => addSubCampo(si, ci)} className="text-xs text-primary-600 hover:text-primary-800">+ Voltaje</button>
                                  </div>
                                  <div className="space-y-1">
                                    {(campo.sub_campos || []).map((sub, subIdx) => (
                                      <div key={subIdx} className="flex items-center gap-1">
                                        <input type="text" value={sub.nombre} onChange={(e) => updateSubCampo(si, ci, subIdx, 'nombre', e.target.value)} className="flex-1 px-1 py-0.5 border rounded text-xs" />
                                        <select value={sub.tipo || 'ac'} onChange={(e) => updateSubCampo(si, ci, subIdx, 'tipo', e.target.value)} className="px-1 py-0.5 border rounded text-xs">
                                          <option value="ac">AC</option>
                                          <option value="dc">DC</option>
                                        </select>
                                        <button type="button" onClick={() => removeSubCampo(si, ci, subIdx)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                                      </div>
                                    ))}
                                  </div>
                                  <label className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                    <input type="checkbox" checked={campo.notas !== false} onChange={(e) => updateCampo(si, ci, 'notas', e.target.checked)} className="rounded" />
                                    Incluir notas
                                  </label>
                                </div>
                              )}

                              {(() => {
                                const photoConfig = getPhotoConfig(campo.tipo)
                                if (!photoConfig) return null
                                return (
                                  <label className="flex items-center gap-1 text-xs text-gray-500 mt-2">
                                    <input
                                      type="checkbox"
                                      checked={campo[photoConfig.key] ?? photoConfig.defaultVal}
                                      onChange={(e) => updateCampo(si, ci, photoConfig.key, e.target.checked)}
                                      className="rounded"
                                    />
                                    {photoConfig.label}
                                  </label>
                                )
                              })()}
                            </div>
                          ))}
                          <div className="flex gap-2">
                            <button type="button" onClick={() => addCampo(si)} className="text-xs text-primary-600 hover:text-primary-800">+ Campo</button>
                            <button type="button" onClick={() => addCampoGrupoStrings(si)} className="text-xs text-primary-600 hover:text-primary-800">+ Grupo Strings</button>
                            <button type="button" onClick={() => addCampoGrupoVoltajes(si)} className="text-xs text-green-600 hover:text-green-800">+ Grupo Voltajes</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Colores</label>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(form.colores).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-2">
                        <input type="color" value={val} onChange={(e) => setForm({ ...form, colores: { ...form.colores, [key]: e.target.value } })} className="w-8 h-8 rounded border cursor-pointer" />
                        <span className="text-xs text-gray-600 capitalize">{key.replace('_', ' ')}</span>
                      </div>
                    ))}
                  </div>
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

      {showEditor && selectedPlantilla && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-xl sm:rounded-lg w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold">Vista Previa</h2>
                <button onClick={() => setShowEditor(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <div className="border rounded-lg p-4" style={{ backgroundColor: selectedPlantilla.colores?.fondo || '#fff' }}>
                <div className="text-center mb-4 pb-3 border-b" style={{ borderColor: selectedPlantilla.colores?.primario || '#0284c7' }}>
                  <h3 className="text-lg font-bold" style={{ color: selectedPlantilla.colores?.primario || '#0284c7' }}>
                    {selectedPlantilla.nombre}
                  </h3>
                  {selectedPlantilla.descripcion && <p className="text-xs text-gray-500 mt-1">{selectedPlantilla.descripcion}</p>}
                </div>
                {selectedPlantilla.secciones?.map((sec, i) => (
                  <div key={i} className="mb-3">
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-1" style={{ color: selectedPlantilla.colores?.texto || '#1f2937' }}>
                      {sec.icono} {sec.titulo}
                    </h4>
                    <div className="ml-6 space-y-2">
                      {sec.campos?.map((campo, ci) => (
                        <div key={ci} className="text-xs">
                          {campo.tipo === 'grupo_strings' ? (
                            <div className="border border-primary-100 rounded p-2 bg-primary-50/50">
                              <span className="font-medium text-primary-700">{campo.nombre}</span>
                              <div className="mt-1 text-gray-500">
                                [Grid de {campo.strings_por_inversor || 6} strings por inversor]
                              </div>
                              {campo.sin_fotos && <span className="text-[10px] text-gray-400 ml-1">(sin fotos)</span>}
                            </div>
                          ) : campo.tipo === 'grupo_voltajes' ? (
                            <div className="border border-green-100 rounded p-2 bg-green-50/50">
                              <span className="font-medium text-green-700">{campo.nombre}</span>
                              <div className="mt-1 grid grid-cols-2 gap-1">
                                {(campo.sub_campos || []).map((sub, subIdx) => (
                                  <div key={subIdx} className="text-gray-500">
                                    {sub.nombre}: <span className="text-gray-300">____</span>
                                  </div>
                                ))}
                              </div>
                              {campo.sin_fotos && <span className="text-[10px] text-gray-400 ml-1">(sin fotos)</span>}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">{campo.nombre}:</span>
                              <span className="text-gray-300">________</span>
                              {campo.foto_unica && <span className="text-[10px] text-green-500">(📷 foto única)</span>}
                              {campo.sin_fotos && <span className="text-[10px] text-gray-400">(sin fotos)</span>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
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
