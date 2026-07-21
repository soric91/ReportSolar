import { useState, useEffect, useRef } from 'react'
import { reportesService } from '../services/reportesService'
import { plantillasService } from '../services/plantillasService'
import { loadDefaultSecciones, getDefaultSeccionesSync } from '../utils/plantillas'
import { pdfGeneratorService } from '../services/pdfGeneratorService'

const ESTADO_COLORS = {
  ok: 'bg-green-100 text-green-700 border-green-200',
  atencion: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  reparado: 'bg-blue-100 text-blue-700 border-blue-200',
  na: 'bg-gray-100 text-gray-500 border-gray-200',
}

const ESTADO_LABELS = {
  ok: 'OK',
  atencion: 'Atención',
  reparado: 'Reparado',
  na: 'N/A',
}

function getSeccionDef(seccionId) {
  return getDefaultSeccionesSync().find(s => s.id === seccionId)
}

function renderCampoValue(campoDef, valor) {
  if (!valor && valor !== 0) return <span className="text-gray-400 italic">Sin dato</span>

  if (typeof valor === 'string' && valor.endsWith('_foto')) {
    const labels = { antes_foto: '📷 Antes', despues_foto: '📷 Después', foto_unica_foto: '📷 Foto' }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium border bg-green-50 text-green-700 border-green-200">
        {labels[valor] || '📷 Foto'}
      </span>
    )
  }

  if (campoDef?.tipo === 'estado') {
    const color = ESTADO_COLORS[valor] || 'bg-gray-100 text-gray-500 border-gray-200'
    const label = ESTADO_LABELS[valor] || valor
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${color}`}>
        {label}
      </span>
    )
  }

  // Maneja objetos (grupo_strings, grupo_voltajes, o cualquier objeto) - como tabla
  if (typeof valor === 'object' && valor !== null && !Array.isArray(valor)) {
    const entries = Object.entries(valor)
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <tbody>
            {entries.map(([key, val], idx) => {
              // Extrae unidad del nombre o usa "V" por defecto (para strings/voltajes)
              let unidad = key.match(/\(([^)]+)\)/)?.[1] || ''
              if (!unidad && (key.includes('inv') || key.includes('string') || key.includes('L'))) {
                unidad = 'V'
              }
              const nombreLimpio = key.replace(/\s*\([^)]*\)/g, '').trim()
              return (
                <tr key={key} className={`${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                  <td className="px-2 py-1.5 border border-gray-200 text-gray-600 font-medium">{nombreLimpio}</td>
                  <td className="px-2 py-1.5 border border-gray-200 font-mono font-semibold text-gray-800">{val || '-'}</td>
                  {unidad && <td className="px-2 py-1.5 border border-gray-200 text-gray-500 font-medium">{unidad}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return <span className="text-sm text-gray-700">{String(valor)}</span>
}

export default function ReportesPage() {
  const [reportes, setReportes] = useState([])
  const [plantillas, setPlantillas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filtroProyecto, setFiltroProyecto] = useState('')
  const [filtroTecnico, setFiltroTecnico] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [selectedReporte, setSelectedReporte] = useState(null)
  const [showDetail, setShowDetail] = useState(false)
  const [previewFoto, setPreviewFoto] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const pdfRef = useRef(null)
  const ITEMS_PER_PAGE = 15

  const loadData = async () => {
    try {
      await loadDefaultSecciones()
      const [reportesRes, plantillasRes] = await Promise.all([
        reportesService.list(),
        plantillasService.list().catch(() => ({ data: [] })),
      ])
      // Manejar respuestas paginadas
      const reportes = reportesRes.data?.data || reportesRes.data
      const plantillas = plantillasRes.data?.data || plantillasRes.data
      setReportes(Array.isArray(reportes) ? reportes : [])
      setPlantillas(Array.isArray(plantillas) ? plantillas : [])
    } catch (err) {
      setError('Error al cargar reportes')
      setReportes([])
      setPlantillas([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const openDetail = async (reporte) => {
    try {
      const res = await reportesService.get(reporte.id)
      setSelectedReporte(res.data)
    } catch {
      setSelectedReporte(reporte)
    }
    setShowDetail(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este informe?')) return
    try {
      await reportesService.delete(id)
      setReportes(reportes.filter(r => r.id !== id))
      setShowDetail(false)
    } catch (err) {
      setError('Error al eliminar')
    }
  }

  const handleExportPDF = async () => {
    if (!selectedReporte) return
    setExporting(true)
    try {
      const secciones = getDefaultSeccionesSync()
      await pdfGeneratorService.generatePDF(
        selectedReporte,
        {
          nombre: selectedReporte.proyecto_nombre,
          cliente: selectedReporte.cliente,
          direccion: selectedReporte.direccion,
          componentes: selectedReporte.componentes || {},
        },
        secciones
      )
    } catch (err) {
      console.error('Error generando PDF:', err)
      setError('Error al generar PDF')
    } finally {
      setExporting(false)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
  }

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const filteredReportes = reportes.filter(r => {
    if (filtroProyecto && r.proyecto_id !== parseInt(filtroProyecto)) return false
    if (filtroTecnico && r.tecnico_id !== parseInt(filtroTecnico)) return false
    if (filtroEstado === 'completado' && r.estado !== 'completado') return false
    if (filtroEstado === 'borrador' && r.estado !== 'borrador') return false
    return true
  })

  const totalPages = Math.ceil(filteredReportes.length / ITEMS_PER_PAGE)
  const paginatedReportes = filteredReportes.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const uniqProyectos = [...new Map(reportes.map(r => [r.proyecto_id, { id: r.proyecto_id, nombre: r.proyecto_nombre }])).values()]
  const uniqTecnicos = [...new Map(reportes.map(r => [r.tecnico_id, { id: r.tecnico_id, nombre: r.tecnico_nombre }])).values()]

  if (loading) return <div className="text-center py-8">Cargando...</div>

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 lg:mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-800">Reportes</h1>
        <div className="flex flex-wrap gap-2 text-xs">
          <select value={filtroProyecto} onChange={(e) => { setFiltroProyecto(e.target.value); setCurrentPage(1) }}
            className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm">
            <option value="">Todos los proyectos</option>
            {uniqProyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <select value={filtroTecnico} onChange={(e) => { setFiltroTecnico(e.target.value); setCurrentPage(1) }}
            className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm">
            <option value="">Todos los técnicos</option>
            {uniqTecnicos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
          <select value={filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value); setCurrentPage(1) }}
            className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm">
            <option value="">Todos los estados</option>
            <option value="completado">Completados</option>
            <option value="borrador">Borradores</option>
          </select>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm">{error}</div>}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 lg:px-4 py-2 lg:py-3 font-medium text-gray-600 text-xs">ID</th>
                <th className="text-left px-3 lg:px-4 py-2 lg:py-3 font-medium text-gray-600 text-xs">Fecha</th>
                <th className="text-left px-3 lg:px-4 py-2 lg:py-3 font-medium text-gray-600 text-xs hidden sm:table-cell">Proyecto</th>
                <th className="text-left px-3 lg:px-4 py-2 lg:py-3 font-medium text-gray-600 text-xs hidden md:table-cell">Técnico</th>
                <th className="text-left px-3 lg:px-4 py-2 lg:py-3 font-medium text-gray-600 text-xs">Estado</th>
                <th className="text-left px-3 lg:px-4 py-2 lg:py-3 font-medium text-gray-600 text-xs">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedReportes.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 lg:px-4 py-2 lg:py-3 font-mono text-xs text-gray-500">#{r.id}</td>
                  <td className="px-3 lg:px-4 py-2 lg:py-3 text-xs">{formatDateTime(r.created_at)}</td>
                  <td className="px-3 lg:px-4 py-2 lg:py-3 text-xs hidden sm:table-cell">
                    <div className="font-medium">{r.proyecto_nombre}</div>
                    <div className="text-gray-400 text-xs">{r.cliente}</div>
                  </td>
                  <td className="px-3 lg:px-4 py-2 lg:py-3 text-xs hidden md:table-cell">{r.tecnico_nombre}</td>
                  <td className="px-3 lg:px-4 py-2 lg:py-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      r.estado === 'completado' ? 'bg-green-100 text-green-700' :
                      r.estado === 'borrador' ? 'bg-yellow-100 text-yellow-700' :
                      r.estado_sync === 'sincronizado' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {r.estado === 'completado' ? 'Completado' :
                       r.estado === 'borrador' ? 'Borrador' :
                       r.estado_sync === 'sincronizado' ? 'Sincronizado' : 'Pendiente'}
                    </span>
                  </td>
                  <td className="px-3 lg:px-4 py-2 lg:py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openDetail(r)} className="text-primary-600 hover:text-primary-800 text-xs font-medium px-2 py-1 rounded hover:bg-primary-50">
                        Ver
                      </button>
                      <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:text-red-700 text-xs font-medium px-2 py-1 rounded hover:bg-red-50">
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredReportes.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400 text-sm">Sin reportes</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <span className="text-xs text-gray-500">
            {filteredReportes.length} resultado{filteredReportes.length !== 1 ? 's' : ''} · Página {currentPage} de {totalPages}
          </span>
          <div className="flex gap-1">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
              ← Anterior
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let page
              if (totalPages <= 5) page = i + 1
              else if (currentPage <= 3) page = i + 1
              else if (currentPage >= totalPages - 2) page = totalPages - 4 + i
              else page = currentPage - 2 + i
              return (
                <button key={page} onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1.5 text-xs border rounded-lg ${currentPage === page ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                  {page}
                </button>
              )
            })}
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {showDetail && selectedReporte && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto p-2 sm:p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl my-4 shadow-2xl">
            <div className="sticky top-0 bg-white border-b px-4 sm:px-6 py-3 flex justify-between items-center rounded-t-xl z-10">
              <h2 className="font-bold text-gray-800">Informe #{selectedReporte.id}</h2>
              <div className="flex items-center gap-2">
                {selectedReporte.estado === 'completado' && (
                  <button onClick={handleExportPDF} disabled={exporting}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-1">
                    {exporting ? (
                      <><svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Generando...</>
                    ) : '📄 Exportar PDF'}
                  </button>
                )}
                <button onClick={() => handleDelete(selectedReporte.id)}
                  className="px-3 py-1.5 text-red-600 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-50">
                  🗑 Eliminar
                </button>
                <button onClick={() => setShowDetail(false)} className="text-gray-400 hover:text-gray-600 text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">✕</button>
              </div>
            </div>

            <div ref={pdfRef} className="p-4 sm:p-6 space-y-5">
              <div className="bg-gradient-to-r from-primary-50 to-blue-50 rounded-xl p-4 border border-primary-100">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500 block mb-0.5">Proyecto</span>
                    <p className="font-semibold text-gray-800">{selectedReporte.proyecto_nombre}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-0.5">Cliente</span>
                    <p className="font-semibold text-gray-800">{selectedReporte.cliente}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-0.5">Técnico</span>
                    <p className="font-semibold text-gray-800">{selectedReporte.tecnico_nombre}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-0.5">Fecha</span>
                    <p className="font-semibold text-gray-800">{formatDate(selectedReporte.created_at)}</p>
                  </div>
                </div>
              </div>

              {Object.entries(selectedReporte.checklist || {}).map(([seccionId, campos]) => {
                if (typeof campos !== 'object' || campos === null) return null
                // Omite la sección de datos_proyecto ya que está en el encabezado
                if (seccionId === 'datos_proyecto') return null
                const secDef = getSeccionDef(seccionId)
                const icon = secDef?.icono || '📋'
                const titulo = secDef?.titulo || seccionId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                return (
                  <div key={seccionId} className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                      <h4 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                        <span>{icon}</span> {titulo}
                      </h4>
                    </div>
                    <div className="p-3 sm:p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {Object.entries(campos).map(([campo, valor]) => {
                          const campoDef = secDef?.campos?.find(c => c.nombre === campo)
                          return (
                            <div key={campo} className="bg-white border border-gray-100 rounded-lg px-3 py-2">
                              <span className="text-xs text-gray-500 block mb-1">{campo}</span>
                              {renderCampoValue(campoDef, valor)}
                            </div>
                          )
                        })}
                      </div>

                      {selectedReporte.fotos?.filter(f => {
                        return f.checklist_item?.startsWith(seccionId + '.')
                      }).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-xs text-gray-400 mb-2">Fotos de esta sección:</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {selectedReporte.fotos
                              .filter(f => f.checklist_item?.startsWith(seccionId + '.'))
                              .map((foto, fi) => (
                                <div key={fi} className="relative group cursor-pointer" onClick={() => setPreviewFoto(foto)}>
                                  <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                                    <img src={foto.url} alt={foto.checklist_item}
                                      className="w-full h-full object-cover"
                                      onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }} />
                                    <div className="hidden w-full h-full items-center justify-center bg-gray-100 text-gray-400 text-xs">Foto no disponible</div>
                                  </div>
                                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1 rounded-b-lg">
                                    <span className="text-white text-[10px] font-medium">
                                      {foto.tipo === 'antes' ? '📷 Antes' : foto.tipo === 'despues' ? '📷 Después' : '📷 Foto'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {selectedReporte.observaciones && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                    <h4 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                      <span>📝</span> Observaciones
                    </h4>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedReporte.observaciones}</p>
                  </div>
                </div>
              )}

              {selectedReporte.recomendaciones && (
                <div className="border border-blue-200 rounded-xl overflow-hidden">
                  <div className="bg-blue-50 px-4 py-2.5 border-b border-blue-200">
                    <h4 className="font-semibold text-sm text-blue-700 flex items-center gap-2">
                      <span>💡</span> Recomendaciones
                    </h4>
                  </div>
                  <div className="p-4 bg-blue-50/30">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedReporte.recomendaciones}</p>
                  </div>
                </div>
              )}

              {selectedReporte.firma_url && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                    <h4 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                      <span>✍️</span> Firma del Técnico
                    </h4>
                  </div>
                  <div className="p-4 flex justify-center bg-white">
                    <img src={selectedReporte.firma_url} alt="Firma"
                      className="border border-gray-200 rounded-lg max-h-24 bg-white px-4" />
                  </div>
                </div>
              )}

              <div className="text-center text-xs text-gray-400 pt-2 border-t border-gray-100">
                Estado: {selectedReporte.estado === 'completado' ? '✅ Completado' : '📝 Borrador'}
                {' · '}Sincronizado: {selectedReporte.estado_sync === 'sincronizado' ? '✅' : '⏳ Pendiente'}
                {' · '}#{selectedReporte.id}
              </div>
            </div>
          </div>
        </div>
      )}

      {previewFoto && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4" onClick={() => setPreviewFoto(null)}>
          <div className="max-w-full max-h-full relative">
            <button onClick={() => setPreviewFoto(null)} className="absolute -top-10 right-0 text-white text-xl hover:text-gray-300">✕ Cerrar</button>
            <img src={previewFoto.url} alt={previewFoto.checklist_item}
              className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain" />
            <div className="text-center mt-2 text-white text-sm">
              {previewFoto.tipo === 'antes' ? '📷 Antes' : previewFoto.tipo === 'despues' ? '📷 Después' : '📷 Foto'} · {previewFoto.checklist_item}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
