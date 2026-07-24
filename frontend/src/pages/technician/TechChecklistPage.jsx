import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { db } from '../../services/db'
import { syncService } from '../../services/syncService'
import { uploadService } from '../../services/uploadService'
import { reportesService } from '../../services/reportesService'
import { loadDefaultSecciones, getDefaultSeccionesSync, ESTADOS, mergeSeccionesWithDefaults } from '../../utils/plantillas'
import { ORIGEN_FOTO, crearInputFoto, calcularDimensiones, construirFoto, agregarFoto, fotosDeCampo } from '../../utils/fotos'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { ArrowLeftIcon, ChevronRightIcon, TrashIcon, CameraIcon, GalleryIcon, CheckIcon, XIcon, SaveIcon, SpinnerIcon, WifiOffIcon } from '../../components/icons'
import Modal from '../../components/Modal'
import FotoSection from '../../components/FotoSection'

export default function TechChecklistPage() {
  const { id, visitaId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const loadedRef = useRef(false)

  // Fecha elegida al crear el informe; si se entra directo, la de hoy
  const fechaVisita = () => {
    const elegida = location.state?.fecha
    return elegida ? new Date(elegida).toISOString() : new Date().toISOString()
  }

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
  const [dirty, setDirty] = useState(false)
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'alert' })
  const isOnline = useOnlineStatus()

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true

    const load = async () => {
      try {
        await loadDefaultSecciones()
        const defaults = getDefaultSeccionesSync()
        setSecciones(defaults)

        const p = await db.getProyecto(id)
        setProyecto(p)
        if (p?.plantilla?.secciones) {
          setSecciones(mergeSeccionesWithDefaults(p.plantilla.secciones, defaults))
        } else if (p?.plantilla && !Array.isArray(p.plantilla)) {
          try {
            const plantillaRes = await reportesService.list({ proyecto_id: id })
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
          const res = await reportesService.list({ proyecto_id: id })
          const all = res.data?.data || res.data || []

          if (visitaId) {
            // La lista navega con el id del reporte; se acepta el de visita
            // por compatibilidad con enlaces guardados de antes
            reporteData = all.find(r => String(r.id) === String(visitaId))
              || all.find(r => r.visita_id && String(r.visita_id) === String(visitaId))
          } else {
            reporteData = all.find(r => r.estado === 'borrador')
            if (!reporteData && all.length > 0) {
              reporteData = all[0]
            }
          }
        } catch (e) {
          if (visitaId) {
            const visitas = await db.getVisitasByProyecto(id)
            const visita = visitas.find(v => String(v.id) === String(visitaId))
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

  useEffect(() => {
    if (!dirty) return
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const updateItem = (secId, campo, valor) => {
    setChecklist(prev => ({
      ...prev,
      [secId]: { ...(prev[secId] || {}), [campo]: valor }
    }))
    setSaved(false)
    setDirty(true)
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
    setDirty(true)
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
        proyecto_id: id,
        fecha: fechaVisita(),
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
      setDirty(false)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'Error: ' + (err.message || 'No se pudo guardar'),
        type: 'alert',
        onConfirm: null
      })
    } finally {
      setSaving(false)
      setUploadProgress(null)
    }
  }

  const handleFinalizar = async () => {
    const datos = checklist['datos_proyecto'] || {}
    if (!datos['Cliente']?.trim()) {
      setModal({
        isOpen: true,
        title: 'Campo vacío',
        message: 'El campo "Cliente" está vacío. ¿Deseas enviar de todas formas?',
        type: 'confirm',
        onConfirm: () => finalizarReporte()
      })
      return
    }
    finalizarReporte()
  }

  const finalizarReporte = async () => {
    setSaving(true)
    try {
      syncService.addToPending({
        reporte_id: serverReporteId,
        proyecto_id: id,
        fecha: fechaVisita(),
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
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'Error al enviar',
        type: 'alert',
        onConfirm: null
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setModal({
      isOpen: true,
      title: 'Eliminar borrador',
      message: '¿Estás seguro que deseas eliminar este borrador?',
      type: 'confirm',
      onConfirm: async () => {
        if (serverReporteId) {
          try { await reportesService.delete(serverReporteId) } catch {}
        }
        navigate(`/tech/proyecto/${id}`)
      }
    })
  }

  // reemplazar: el campo admite una sola foto, la nueva pisa la anterior
  // origen 'camara' abre la cámara directo; 'galeria' deja elegir una imagen ya guardada
  const selectPhoto = (secId, campo, tipo, { reemplazar = false, origen = ORIGEN_FOTO.CAMARA } = {}) => {
    const input = crearInputFoto({ origen })
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return
      try {
        const reader = new FileReader()
        reader.onload = (ev) => {
          const img = new Image()
          img.onload = () => {
            const canvas = document.createElement('canvas')
            const { width: w, height: h } = calcularDimensiones(img.width, img.height)
            canvas.width = w
            canvas.height = h
            canvas.getContext('2d').drawImage(img, 0, 0, w, h)
            const preview = canvas.toDataURL('image/webp', 0.75)

            // Agrega directamente sin modal (con ID único)
            const nueva = construirFoto({ secId, campo, tipo, url: preview })
            setFotos(prev => agregarFoto(prev, nueva, { reemplazar }))
            setDirty(true)
          }
          img.src = ev.target.result
        }
        reader.readAsDataURL(file)
      } catch (err) {
        setModal({
          isOpen: true,
          title: 'Error',
          message: 'Error al procesar la foto',
          type: 'alert',
          onConfirm: null
        })
      }
    }
    input.click()
  }

  const deleteFoto = (fotoId) => {
    setFotos(prev => prev.filter(f => f.id !== fotoId))
    setDirty(true)
  }

  const handleSectionChange = (i) => {
    if (i === activeIdx) return
    if (!dirty) {
      setActiveIdx(i)
      return
    }
    setModal({
      isOpen: true,
      title: 'Cambios sin guardar',
      message: 'Tenés cambios sin guardar en esta sección. ¿Guardar antes de continuar?',
      type: 'confirm',
      confirmText: 'Guardar y continuar',
      onConfirm: async () => {
        await handleSave()
        setActiveIdx(i)
      },
    })
  }

  // Guarda antes de avanzar: así nunca se llega a la sección siguiente
  // con cambios pendientes, y sin obligar al técnico a tocar dos botones
  const handleSiguiente = async () => {
    if (dirty) await handleSave()
    setActiveIdx(i => i + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleBackNavigation = (to) => {
    if (!dirty) {
      navigate(to)
      return
    }
    setModal({
      isOpen: true,
      title: 'Cambios sin guardar',
      message: 'Tenés cambios sin guardar. ¿Guardar antes de salir?',
      type: 'confirm',
      confirmText: 'Guardar y salir',
      onConfirm: async () => {
        await handleSave()
        navigate(to)
      },
    })
  }

  const getFotosForCampo = (secId, campo) => fotosDeCampo(fotos, secId, campo)

  const renderFotoSection = (secId, campo) => (
    <FotoSection
      secId={secId}
      campo={campo}
      fotos={fotos}
      onSelect={(tipo, opts) => selectPhoto(secId, campo.nombre, tipo, opts)}
      onDelete={deleteFoto}
    />
  )

  const renderCampo = (secId, campo, idx) => {
    const val = checklist[secId]?.[campo.nombre] || ''

    if (campo.tipo === 'grupo_strings') {
      const numInv = proyecto?.componentes?.inversores || 1
      const numStr = campo.strings_por_inversor || 4
      const grupoVal = val || {}
      const fotoPerItem = campo.foto_per_item

      return (
        <div key={idx} className="md:col-span-2 lg:col-span-3 bg-white rounded-lg p-3 shadow-sm border border-gray-100">
          <h4 className="font-semibold text-gray-800 text-xs mb-3">{campo.nombre}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: numInv * numStr }, (_, idx) => {
              const i = Math.floor(idx / numStr)
              const j = idx % numStr
              const key = `inv${i + 1}_string${j + 1}`
              const itemLabel = `String ${j + 1} - Inv ${i + 1}`
              return (
                <div key={key} className="border border-gray-200 rounded-lg p-2 bg-gray-50">
                  <label className="text-xs font-semibold text-gray-700 block mb-1.5">{itemLabel}</label>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <input type="number" step="0.1" value={grupoVal[key] || ''}
                        onChange={(e) => updateSubItem(secId, campo.nombre, key, e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                        placeholder="V" />
                    </div>
                    {fotoPerItem && (
                      <>
                        <button onClick={() => selectPhoto(secId, `${campo.nombre}_${key}`, 'unica', { origen: ORIGEN_FOTO.CAMARA })}
                          title={`${itemLabel}: tomar foto`} aria-label={`${itemLabel}: tomar foto`}
                          className="px-2 py-1.5 bg-primary-100 text-primary-700 rounded hover:bg-primary-200">
                          <CameraIcon className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => selectPhoto(secId, `${campo.nombre}_${key}`, 'unica', { origen: ORIGEN_FOTO.GALERIA })}
                          title={`${itemLabel}: elegir de galería`} aria-label={`${itemLabel}: elegir de galería`}
                          className="px-2 py-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">
                          <GalleryIcon className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                  {fotoPerItem && (
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {getFotosForCampo(secId, `${campo.nombre}_${key}`).map((foto) => (
                        <div key={foto.id} className="relative">
                          <img src={foto.url} alt={itemLabel} className="w-12 h-12 object-cover rounded border border-primary-200" />
                          <button onClick={() => deleteFoto(foto.id)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    if (campo.tipo === 'grupo_voltajes') {
      const ac = campo.sub_campos?.filter(c => c.tipo === 'ac') || []
      const dc = campo.sub_campos?.filter(c => c.tipo === 'dc') || []
      const grupoVal = val || {}
      const fotoPerItem = campo.foto_per_item

      return (
        <div key={idx} className="md:col-span-2 lg:col-span-3 bg-white rounded-lg p-3 shadow-sm border border-gray-100">
          <h4 className="font-semibold text-gray-800 text-xs mb-3">{campo.nombre}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[...ac, ...dc].map((sub, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-2 bg-gray-50">
                <label className="text-xs font-semibold text-gray-700 block mb-1.5">{sub.nombre}</label>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <input type="number" step="0.1" value={grupoVal[sub.nombre] || ''}
                      onChange={(e) => updateSubItem(secId, campo.nombre, sub.nombre, e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                      placeholder={sub.placeholder || 'V'} />
                  </div>
                  {fotoPerItem && (
                    <>
                      <button onClick={() => selectPhoto(secId, `${campo.nombre}_${sub.nombre}`, 'unica', { origen: ORIGEN_FOTO.CAMARA })}
                        title={`${sub.nombre}: tomar foto`} aria-label={`${sub.nombre}: tomar foto`}
                        className="px-2 py-1.5 bg-primary-100 text-primary-700 rounded hover:bg-primary-200">
                        <CameraIcon className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => selectPhoto(secId, `${campo.nombre}_${sub.nombre}`, 'unica', { origen: ORIGEN_FOTO.GALERIA })}
                        title={`${sub.nombre}: elegir de galería`} aria-label={`${sub.nombre}: elegir de galería`}
                        className="px-2 py-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">
                        <GalleryIcon className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
                {fotoPerItem && (
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {getFotosForCampo(secId, `${campo.nombre}_${sub.nombre}`).map((foto) => (
                      <div key={foto.id} className="relative">
                        <img src={foto.url} alt={sub.nombre} className="w-12 h-12 object-cover rounded border border-primary-200" />
                        <button onClick={() => deleteFoto(foto.id)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )
    }

    return (
      <div key={idx} className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-semibold text-gray-800 text-xs flex-1 line-clamp-2">{campo.nombre}</h4>
          {(val || getFotosForCampo(secId, campo.nombre).length > 0) && (
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
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50">
      <div className="sticky top-0 z-10">
        <header className="bg-white shadow-md border-b border-primary-100">
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => handleBackNavigation(`/tech/proyecto/${id}`)} className="text-gray-500 hover:text-gray-700 -ml-1 p-2 rounded-lg hover:bg-gray-100 transition-colors">
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

        <div className="overflow-x-auto bg-white border-b shadow-sm">
        <div className="flex px-2 py-3 gap-1 min-w-min">
          {seccionesExpandidas.map((s, i) => {
            const count = s.campos?.reduce((acc, c) => acc + getFotosForCampo(s.id, c.nombre).length, 0) || 0
            const isCompleted = s.campos?.some(c => checklist[s.id]?.[c.nombre])
            return (
              <button key={i} onClick={() => handleSectionChange(i)}
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
      </div>

      {uploadProgress && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 bg-primary-50 text-primary-700">
          <SpinnerIcon className="w-4 h-4" />
          Subiendo foto {uploadProgress.current + 1} de {uploadProgress.total}...
        </div>
      )}

      {fotos.length > 0 && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-xl text-xs font-medium bg-green-50 text-green-700 flex items-center gap-1.5">
          <CameraIcon className="w-3.5 h-3.5" /> {fotos.length} foto{fotos.length !== 1 ? 's' : ''}
        </div>
      )}

      <main className="px-4 py-4 pb-32 w-full">
        <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-primary-50 to-primary-50 border border-primary-100">
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
            className="flex-1 px-4 py-2.5 min-h-[44px] bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {saving ? <SpinnerIcon className="w-4 h-4" /> : saved ? <CheckIcon className="w-4 h-4" /> : <SaveIcon className="w-4 h-4" />}
            {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar'}
          </button>
          {!isLastSection && (
            <button onClick={handleSiguiente} disabled={saving}
              title={dirty ? 'Guarda esta sección y pasa a la siguiente' : 'Pasar a la siguiente sección'}
              className="flex-1 px-4 py-2.5 min-h-[44px] bg-white text-primary-700 border border-primary-300 rounded-lg text-sm font-medium hover:bg-primary-50 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
              Siguiente
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          )}
        </div>
        {isLastSection && (
          <>
            <div className="mt-6 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h4 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
                📝 Observaciones Generales
              </h4>
              <textarea value={observaciones} onChange={(e) => { setObservaciones(e.target.value); setDirty(true) }}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white focus:border-primary-400 focus:outline-none transition-colors min-h-[100px] resize-none"
                placeholder="Describe cualquier observación importante..." />
            </div>
            <div className="mt-4 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h4 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
                💡 Recomendaciones
              </h4>
              <textarea value={recomendaciones} onChange={(e) => { setRecomendaciones(e.target.value); setDirty(true) }}
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

      <Modal
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        confirmText={modal.confirmText || (modal.type === 'confirm' ? 'Confirmar' : 'Aceptar')}
        onClose={() => setModal({ ...modal, isOpen: false })}
        onConfirm={modal.onConfirm}
      />
    </div>
  )
}
