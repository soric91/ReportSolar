import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../../services/db'
import { syncService } from '../../services/syncService'
import { uploadService } from '../../services/uploadService'
import { reportesService } from '../../services/reportesService'
import { loadDefaultSecciones, getDefaultSeccionesSync, ESTADOS, mergeSeccionesWithDefaults } from '../../utils/plantillas'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { ArrowLeftIcon, TrashIcon, CameraIcon, CheckIcon, XIcon, SaveIcon, SpinnerIcon, WifiOffIcon } from '../../components/icons'

export default function TechChecklistPage() {
  const { id, visitaId } = useParams()
  const navigate = useNavigate()
  const loadedRef = useRef(false)

  const [proyecto, setProyecto] = useState(null)
  const [secciones, setSecciones] = useState([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [checklist, setChecklist] = useState({})
  const [observaciones, setObservaciones] = useState('')
  const [recomendaciones, setRecomendaciones] = useState('')
  const [fotos, setFotos] = useState([])
  const [serverReporteId, setServerReporteId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const isOnline = useOnlineStatus()

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true

    const load = async () => {
      try {
        await loadDefaultSecciones()
        const defaults = getDefaultSeccionesSync()
        setSecciones(defaults)

        const p = await db.getProyecto(parseInt(id))
        setProyecto(p)
        if (p?.plantilla?.secciones) {
          setSecciones(mergeSeccionesWithDefaults(p.plantilla.secciones, defaults))
        } else if (p?.plantilla && !Array.isArray(p.plantilla)) {
          try {
            const plantillaRes = await reportesService.list({ proyecto_id: parseInt(id) })
            const reporte = (plantillaRes.data?.data || plantillaRes.data)?.[0]
            if (reporte?.plantilla?.secciones) {
              setSecciones(mergeSeccionesWithDefaults(reporte.plantilla.secciones, defaults))
            }
          } catch (e) {
            // Plantilla no disponible
          }
        }

        let reporteData = null
        try {
          const res = await reportesService.list({ proyecto_id: parseInt(id) })
          const all = res.data?.data || res.data || []

          if (visitaId) {
            reporteData = all.find(r => r.visita_id === parseInt(visitaId))
          } else {
            reporteData = all.find(r => r.estado === 'borrador')
            if (!reporteData && all.length > 0) {
              reporteData = all[0]
            }
          }
        } catch (e) {
          if (visitaId) {
            const visitas = await db.getVisitasByProyecto(parseInt(id))
            const visita = visitas.find(v => v.id === parseInt(visitaId))
            if (visita) {
              setChecklist(visita.checklist || {})
              setObservaciones(visita.observaciones || '')
              setRecomendaciones(visita.recomendaciones || '')
              setFotos(visita.fotos || [])
            }
          }
        }

        if (reporteData) {
          setChecklist(reporteData.checklist || {})
          setObservaciones(reporteData.observaciones || '')
          setRecomendaciones(reporteData.recomendaciones || '')
          // Asegura que cada foto tenga un ID único
          const fotosConId = (reporteData.fotos || []).map((foto, idx) => ({
            ...foto,
            id: foto.id || `${foto.checklist_item}_${foto.tipo}_${idx}`,
            uploaded: true,
          }))
          setFotos(fotosConId)
          setServerReporteId(reporteData.id)
        } else {
          // Pre-fill proyecto data for new informe
          if (p) {
            setChecklist({
              datos_proyecto: {
                Cliente: p.cliente || '',
                Dirección: p.direccion || '',
                'Tipo de Sistema': p.tipo_sistema || '',
                Técnico: p.tecnicos?.[0]?.nombre || '',
              }
            })
          }
        }
      } catch (err) {
        console.error('Error cargando:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, visitaId])

  const updateItem = (secId, campo, valor) => {
    setChecklist(prev => ({
      ...prev,
      [secId]: { ...(prev[secId] || {}), [campo]: valor }
    }))
    setSaved(false)
  }

  const updateSubItem = (secId, campo, subKey, valor) => {
    setChecklist(prev => {
      const sec = prev[secId] || {}
      const campoVal = sec[campo] || {}
      return {
        ...prev,
        [secId]: { ...sec, [campo]: { ...campoVal, [subKey]: valor } }
      }
    })
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Primero, sube las fotos no subidas
      const fotosNoSubidas = fotos.filter(f => !f.uploaded && f.dataUrl)

      let subidas = 0
      for (const foto of fotosNoSubidas) {
        setUploadProgress({ current: subidas, total: fotosNoSubidas.length })
        try {
          const result = await uploadService.uploadFoto({
            projectName: proyecto.nombre,
            projectId: proyecto.id,
            checklistItem: foto.checklist_item,
            tipo: foto.tipo,
            dataUrl: foto.dataUrl,
          })
          // Actualiza la foto con URL real de Supabase
          setFotos(prev => prev.map(f =>
            f.checklist_item === foto.checklist_item && f.tipo === foto.tipo
              ? { ...f, url: result.url, path: result.path, uploaded: true }
              : f
          ))
        } catch (err) {
          // Marca la foto como fallida pero continúa con otras
          setFotos(prev => prev.map(f =>
            f.checklist_item === foto.checklist_item && f.tipo === foto.tipo
              ? { ...f, uploaded: false, uploadError: true }
              : f
          ))
        }
        subidas++
      }
      setUploadProgress(null)

      // Guarda solo las fotos que se subieron exitosamente (uploaded: true)
      // Las fotos locales sin URL no se guardan en la BD
      const fotosFinales = fotos
        .filter(f => f.uploaded === true)
        .map(({ dataUrl, uploadError, ...resto }) => resto)

      const saveData = {
        reporte_id: serverReporteId,
        proyecto_id: parseInt(id),
        fecha: new Date().toISOString(),
        estado: 'en_progreso',
        reporte_estado: 'borrador',
        checklist: checklist || {},
        observaciones: observaciones || '',
        recomendaciones: recomendaciones || '',
        fotos: fotosFinales || [],
      }

      syncService.addToPending(saveData)
      const result = await syncService.syncAll()

      if (result?.detalles?.length > 0) {
        const ok = result.detalles.find(d => d.status === 'ok')
        if (ok?.reporte_id) {
          setServerReporteId(ok.reporte_id)
        }
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      alert('Error: ' + (err.message || 'No se pudo guardar'))
    } finally {
      setSaving(false)
      setUploadProgress(null)
    }
  }

  const handleFinalizar = async () => {
    const datos = checklist['datos_proyecto'] || {}
    if (!datos['Cliente']?.trim()) {
      if (!confirm('Campo "Cliente" vacío. ¿Enviar de todas formas?')) return
    }
    setSaving(true)
    try {
      syncService.addToPending({
        reporte_id: serverReporteId,
        proyecto_id: parseInt(id),
        fecha: new Date().toISOString(),
        estado: 'finalizada',
        reporte_estado: 'completado',
        checklist,
        observaciones,
        recomendaciones,
        fotos,
      })
      await syncService.syncAll()
      navigate(`/tech/proyecto/${id}`)
    } catch (err) {
      alert('Error al enviar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('¿Eliminar este borrador?')) return
    if (serverReporteId) {
      try { await reportesService.delete(serverReporteId) } catch {}
    }
    navigate(`/tech/proyecto/${id}`)
  }

  const selectPhoto = (secId, campo, tipo) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return
      try {
        const reader = new FileReader()
        reader.onload = (ev) => {
          const img = new Image()
          img.onload = () => {
            const canvas = document.createElement('canvas')
            const max = 1600
            let w = img.width, h = img.height
            if (w > max || h > max) {
              if (w > h) { h = (h / w) * max; w = max }
              else { w = (w / h) * max; h = max }
            }
            canvas.width = w
            canvas.height = h
            canvas.getContext('2d').drawImage(img, 0, 0, w, h)
            const preview = canvas.toDataURL('image/webp', 0.75)
            const checklistItem = `${secId}.${campo}`

            // Agrega directamente sin modal (con ID único)
            setFotos(prev => [...prev, {
              id: `${checklistItem}_${tipo}_${Date.now()}`,
              url: preview,
              checklist_item: checklistItem,
              tipo: tipo,
              dataUrl: preview,
              uploaded: false,
            }])
          }
          img.src = ev.target.result
        }
        reader.readAsDataURL(file)
      } catch (err) {
        alert('Error al procesar la foto')
      }
    }
    input.click()
  }

  const deleteFoto = (fotoId) => {
    setFotos(prev => prev.filter(f => f.id !== fotoId))
  }

  const getFotosForCampo = (secId, campo) => {
    return fotos.filter(f => f.checklist_item === `${secId}.${campo}`)
  }

  const renderFotoSection = (secId, campo) => {
    if (campo.sin_fotos) return null
    const tienePhoto = campo.foto_requerida || campo.foto_unica
    if (!tienePhoto) return null

    const campoFotos = getFotosForCampo(secId, campo)
    const fotosAntes = campoFotos.filter(f => f.tipo === 'antes')
    const fotosDespues = campoFotos.filter(f => f.tipo === 'despues')
    const fotoUnica = campoFotos.filter(f => f.tipo === 'foto_unica')

    return (
      <div className="mt-4 pt-4 border-t border-gray-200">
        <h5 className="text-xs font-bold text-gray-700 mb-3 flex items-center gap-1.5"><CameraIcon className="w-3.5 h-3.5" /> {campo.foto_requerida ? 'Fotos (Antes/Después)' : 'Foto'}</h5>

        {campo.foto_requerida ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <button onClick={() => selectPhoto(secId, campo.nombre, 'antes')}
                className={`py-3 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 min-h-[44px] ${
                  fotosAntes.length > 0
                    ? 'bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-200'
                    : 'bg-gray-50 text-gray-600 border border-gray-300 hover:bg-gray-100'
                }`}>
                {fotosAntes.length > 0 ? <CheckIcon className="w-4 h-4" /> : <CameraIcon className="w-4 h-4" />} Antes
              </button>
              {fotosAntes.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {fotosAntes.map((foto, idx) => (
                    <div key={idx} className="relative w-full">
                      <img src={foto.url} alt="antes" className="w-full h-24 object-cover rounded-lg border-2 border-blue-300" />
                      {!foto.uploaded && <span className="absolute top-1 left-1 bg-yellow-500 text-white text-[8px] px-1 rounded">local</span>}
                      <button onClick={() => deleteFoto(foto.id)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white w-7 h-7 rounded-full flex items-center justify-center shadow-md">
                        <XIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <button onClick={() => selectPhoto(secId, campo.nombre, 'despues')}
                className={`py-3 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 min-h-[44px] ${
                  fotosDespues.length > 0
                    ? 'bg-green-100 text-green-700 border border-green-300 hover:bg-green-200'
                    : 'bg-gray-50 text-gray-600 border border-gray-300 hover:bg-gray-100'
                }`}>
                {fotosDespues.length > 0 ? <CheckIcon className="w-4 h-4" /> : <CameraIcon className="w-4 h-4" />} Después
              </button>
              {fotosDespues.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {fotosDespues.map((foto, idx) => (
                    <div key={idx} className="relative w-full">
                      <img src={foto.url} alt="despues" className="w-full h-24 object-cover rounded-lg border-2 border-green-300" />
                      {!foto.uploaded && <span className="absolute top-1 left-1 bg-yellow-500 text-white text-[8px] px-1 rounded">local</span>}
                      <button onClick={() => deleteFoto(foto.id)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white w-7 h-7 rounded-full flex items-center justify-center shadow-md">
                        <XIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <button onClick={() => selectPhoto(secId, campo.nombre, 'foto_unica')}
              className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 min-h-[44px] ${
                fotoUnica.length > 0
                  ? 'bg-green-100 text-green-700 border border-green-300 hover:bg-green-200'
                  : 'bg-blue-50 text-blue-600 border border-blue-300 hover:bg-blue-100'
              }`}>
              {fotoUnica.length > 0 ? <CheckIcon className="w-4 h-4" /> : <CameraIcon className="w-4 h-4" />} {fotoUnica.length > 0 ? 'Foto Cargada' : 'Cargar Foto'}
            </button>
            {fotoUnica.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {fotoUnica.map((foto, idx) => (
                  <div key={idx} className="relative">
                    <img src={foto.url} alt="foto" className="w-20 h-20 object-cover rounded-lg border-2 border-green-300" />
                    {!foto.uploaded && <span className="absolute top-0 left-0 bg-yellow-500 text-white text-[8px] px-1 rounded">local</span>}
                    <button onClick={() => deleteFoto(foto.id)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white w-7 h-7 rounded-full flex items-center justify-center shadow-md">
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderCampo = (secId, campo, idx) => {
    const val = checklist[secId]?.[campo.nombre] || ''
    if (idx === 0 && secId === 'datos_proyecto') {
      console.log(`🔍 renderCampo: secId=${secId}, campo=${campo.nombre}, val=${val}, secData=`, checklist[secId])
    }

    if (campo.tipo === 'grupo_strings') {
      const numInv = proyecto?.componentes?.inversores || 1
      const numStr = campo.strings_por_inversor || 4
      const grupoVal = val || {}
      return (
        <div key={idx} className="md:col-span-2 lg:col-span-3 bg-white rounded-lg p-3 shadow-sm border border-gray-100">
          <h4 className="font-semibold text-gray-800 text-xs mb-2">{campo.nombre}</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {Array.from({ length: numInv * numStr }, (_, idx) => {
              const i = Math.floor(idx / numStr)
              const j = idx % numStr
              const key = `inv${i + 1}_string${j + 1}`
              return (
                <div key={key}>
                  <label className="text-xs text-gray-500 block mb-0.5">S{j + 1} Inv{i + 1}</label>
                  <input type="number" step="0.1" value={grupoVal[key] || ''}
                    onChange={(e) => updateSubItem(secId, campo.nombre, key, e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-gray-50"
                    placeholder="V" />
                </div>
              )
            })}
          </div>
          {renderFotoSection(secId, campo)}
        </div>
      )
    }

    if (campo.tipo === 'grupo_voltajes') {
      const ac = campo.sub_campos?.filter(c => c.tipo === 'ac') || []
      const dc = campo.sub_campos?.filter(c => c.tipo === 'dc') || []
      const grupoVal = val || {}
      return (
        <div key={idx} className="md:col-span-2 lg:col-span-3 bg-white rounded-lg p-3 shadow-sm border border-gray-100">
          <h4 className="font-semibold text-gray-800 text-xs mb-2">{campo.nombre}</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[...ac, ...dc].map((sub, i) => (
              <div key={i}>
                <label className="text-xs text-gray-500 block mb-0.5">{sub.nombre}</label>
                <input type="number" step="0.1" value={grupoVal[sub.nombre] || ''}
                  onChange={(e) => updateSubItem(secId, campo.nombre, sub.nombre, e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-gray-50"
                  placeholder={sub.placeholder || 'V'} />
              </div>
            ))}
          </div>
          {renderFotoSection(secId, campo)}
        </div>
      )
    }

    return (
      <div key={idx} className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-semibold text-gray-800 text-xs flex-1 line-clamp-2">{campo.nombre}</h4>
          {(val || (campo.foto_requerida && getFotosForCampo(secId, campo.nombre).length > 0)) && (
            <span className="text-xs text-green-600 font-bold ml-1 shrink-0">✓</span>
          )}
        </div>
        {campo.tipo === 'estado' && (
          <textarea value={val} onChange={(e) => updateItem(secId, campo.nombre, e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white focus:border-primary-400 focus:outline-none transition-colors min-h-[80px] resize-none"
            placeholder="Describe el estado (OK, Atención, Reparado, N/A o comentario detallado)..." />
        )}
        {campo.tipo === 'texto' && (
          <input type="text" value={val} onChange={(e) => updateItem(secId, campo.nombre, e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-gray-50 focus:bg-white focus:border-primary-400 focus:outline-none transition-colors"
            placeholder={campo.placeholder || '...'} />
        )}
        {campo.tipo === 'numero' && (
          <input type="number" step={campo.step || '0.1'} value={val}
            onChange={(e) => updateItem(secId, campo.nombre, e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-gray-50 focus:bg-white focus:border-primary-400 focus:outline-none transition-colors"
            placeholder={campo.placeholder || '0'} />
        )}
        {campo.tipo === 'textarea' && (
          <textarea value={val} onChange={(e) => updateItem(secId, campo.nombre, e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-gray-50 focus:bg-white focus:border-primary-400 focus:outline-none transition-colors min-h-[60px] resize-none"
            placeholder={campo.placeholder || 'Notas...'} />
        )}
        {campo.tipo === 'fecha' && (
          <input type="date" value={val} onChange={(e) => updateItem(secId, campo.nombre, e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-gray-50 focus:bg-white focus:border-primary-400 focus:outline-none transition-colors" />
        )}
        {campo.tipo === 'select' && (
          <select value={val} onChange={(e) => updateItem(secId, campo.nombre, e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-gray-50 focus:bg-white focus:border-primary-400 focus:outline-none transition-colors">
            <option value="">-- Selecciona --</option>
            {(campo.opciones || []).map((op, i) => (
              <option key={i} value={op}>{op}</option>
            ))}
          </select>
        )}
        {renderFotoSection(secId, campo)}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <SpinnerIcon className="h-8 w-8 text-primary-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Cargando informe...</p>
        </div>
      </div>
    )
  }

  if (!proyecto) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Proyecto no encontrado</p>
      </div>
    )
  }

  // Obtiene cantidad de inversores - con un mínimo de 1
  let cantidadInversores = 1
  if (checklist['datos_proyecto']) {
    const cant = parseInt(checklist['datos_proyecto']['Cantidad de Inversores'])
    if (!isNaN(cant) && cant > 0) {
      cantidadInversores = cant
    }
  }

  // Expande secciones dinámicas según inversores
  const seccionesExpandidas = secciones.flatMap(sec => {
    if (sec.dinamico_inversores) {
      // Crea N secciones, una por cada inversor
      return Array.from({ length: cantidadInversores }, (_, i) => ({
        ...sec,
        id: `${sec.id}_inv${i + 1}`,
        titulo: `${sec.titulo} - Inversor ${i + 1}`,
        inversorNum: i + 1,
        original_id: sec.id,
      }))
    }
    return [sec]
  })

  // Calcula progreso por campos completados
  const totalCampos = seccionesExpandidas.reduce((acc, s) => acc + (s.campos?.length || 0), 0)
  const completedCampos = seccionesExpandidas.reduce((acc, s) => {
    return acc + (s.campos?.filter(c => checklist[s.id]?.[c.nombre]).length || 0)
  }, 0)
  const progress = totalCampos > 0 ? Math.round((completedCampos / totalCampos) * 100) : 0

  // Valida que activeIdx sea válido
  const validActiveIdx = activeIdx >= seccionesExpandidas.length ? 0 : activeIdx
  const sec = seccionesExpandidas[validActiveIdx]
  const isLastSection = validActiveIdx === seccionesExpandidas.length - 1
  const hasDraft = serverReporteId && checklist && Object.keys(checklist).length > 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <header className="bg-white shadow-md sticky top-0 z-10 border-b border-blue-100">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => navigate(`/tech/proyecto/${id}`)} className="text-gray-500 hover:text-gray-700 -ml-1 p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div className="flex flex-col items-center">
              <h1 className="font-bold text-gray-800 text-base">
                {hasDraft ? 'Editando Informe' : 'Nuevo Informe'}
              </h1>
              {!isOnline && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-50 text-red-600 rounded-full text-[10px] font-medium mt-0.5">
                  <WifiOffIcon className="w-3 h-3" /> Sin conexión
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {hasDraft && (
                <button onClick={handleDelete} className="text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors">
                  <TrashIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-gradient-to-r from-primary-500 to-primary-600 h-2 rounded-full transition-all duration-300" style={{width: `${progress}%`}}/>
              </div>
            </div>
            <span className="text-xs font-bold text-gray-600 min-w-fit">{progress}%</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">{completedCampos} de {totalCampos} campos completados</p>
        </div>
      </header>

      {uploadProgress && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 bg-blue-50 text-blue-700">
          <SpinnerIcon className="w-4 h-4" />
          Subiendo foto {uploadProgress.current + 1} de {uploadProgress.total}...
        </div>
      )}

      {fotos.length > 0 && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-xl text-xs font-medium bg-green-50 text-green-700 flex items-center gap-1.5">
          <CameraIcon className="w-3.5 h-3.5" /> {fotos.length} foto{fotos.length !== 1 ? 's' : ''}
        </div>
      )}


      <div className="overflow-x-auto bg-white border-b sticky top-[140px] z-10 shadow-sm">
        <div className="flex px-2 py-3 gap-1 min-w-min">
          {seccionesExpandidas.map((s, i) => {
            const count = s.campos?.reduce((acc, c) => acc + getFotosForCampo(s.id, c.nombre).length, 0) || 0
            const isCompleted = s.campos?.some(c => checklist[s.id]?.[c.nombre])
            return (
              <button key={i} onClick={() => setActiveIdx(i)}
                className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap flex items-center gap-1 transition-all ${
                  validActiveIdx === i
                    ? 'bg-primary-600 text-white shadow-md'
                    : isCompleted
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {s.icono || '📋'} {s.titulo}
                {isCompleted && <span className="ml-1 text-xs">✓</span>}
                {count > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    activeIdx === i ? 'bg-white/20 text-white' : 'bg-primary-100 text-primary-600'
                  }`}>
                    {count}📷
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <main className="px-4 py-4 pb-32 w-full">
        <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-100">
          <h2 className="font-bold text-gray-800 text-base mb-0.5">{sec.icono} {sec.titulo}</h2>
          <p className="text-xs text-gray-600">
            {sec.campos?.length || 0} campo{sec.campos?.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 auto-rows-max">
          {(sec.campos || []).map((campo, ci) => renderCampo(sec.id, campo, ci))}
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2.5 min-h-[44px] bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-2">
            {saving ? <SpinnerIcon className="w-4 h-4" /> : saved ? <CheckIcon className="w-4 h-4" /> : <SaveIcon className="w-4 h-4" />}
            {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar Sección'}
          </button>
        </div>
        {isLastSection && (
          <>
            <div className="mt-6 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h4 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
                📝 Observaciones Generales
              </h4>
              <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white focus:border-primary-400 focus:outline-none transition-colors min-h-[100px] resize-none"
                placeholder="Describe cualquier observación importante..." />
            </div>
            <div className="mt-4 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h4 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
                💡 Recomendaciones
              </h4>
              <textarea value={recomendaciones} onChange={(e) => setRecomendaciones(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white focus:border-primary-400 focus:outline-none transition-colors min-h-[100px] resize-none"
                placeholder="Describe las recomendaciones o acciones pendientes..." />
            </div>
          </>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent border-t border-gray-200 p-4 z-10">
        <div className="px-4 w-full">
          <button onClick={handleFinalizar} disabled={saving}
            className="w-full py-3.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-bold text-base shadow-lg hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {saving ? (
              <>
                <SpinnerIcon className="w-5 h-5" />
                Enviando Informe...
              </>
            ) : (
              <>
                <CheckIcon className="w-5 h-5" />
                Enviar Informe Completo
              </>
            )}
          </button>
          <p className="text-center text-xs text-gray-500 mt-2">
            {completedCampos}/{totalCampos} campos completados ({progress}%)
          </p>
        </div>
      </div>
    </div>
  )
}
