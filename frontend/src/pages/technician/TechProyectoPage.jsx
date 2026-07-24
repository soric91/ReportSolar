import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../../services/db'
import { reportesService } from '../../services/reportesService'
import { syncService } from '../../services/syncService'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { ArrowLeftIcon, PlusIcon, TrashIcon, CheckCircleIcon, ClockIcon, WifiOffIcon } from '../../components/icons'
import Modal from '../../components/Modal'

export default function TechProyectoPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [proyecto, setProyecto] = useState(null)
  const [visitas, setVisitas] = useState([])
  const [showNuevaVisita, setShowNuevaVisita] = useState(false)
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'alert' })
  const isOnline = useOnlineStatus()

  // El informe existe en un solo lugar: el servidor. Antes se creaba además
  // una visita local al abrir el checklist, que nunca se rellenaba ni se
  // borraba al sincronizar, así que el mismo informe aparecía dos veces.
  const cargarInformes = async () => {
    try {
      const apiRes = await reportesService.list({ proyecto_id: id })
      const data = apiRes.data?.data ?? apiRes.data
      const reportes = Array.isArray(data) ? data : data ? [data] : []
      setVisitas(reportes.map(r => ({
        id: r.id,
        fecha: r.created_at ? r.created_at.split('T')[0] : '',
        estado: r.estado === 'completado' ? 'finalizada' : 'en_progreso',
      })))
    } catch (apiErr) {
      console.warn('API no disponible, mostrando lo pendiente de sincronizar:', apiErr)
      setVisitas(
        syncService.getPending()
          .filter(p => p.proyecto_id === id)
          .map(p => ({
            id: p.reporte_id || null,
            fecha: p.fecha ? p.fecha.split('T')[0] : '',
            estado: p.reporte_estado === 'completado' ? 'finalizada' : 'en_progreso',
            pendiente: true,
          }))
      )
    }
  }

  useEffect(() => {
    const load = async () => {
      try {
        const p = await db.getProyecto(id)
        setProyecto(p)

        // Purga las visitas locales huérfanas que dejaron versiones anteriores
        const locales = await db.getVisitasByProyecto(id)
        for (const v of locales) {
          if (!v.checklist || Object.keys(v.checklist).length === 0) {
            await db.deleteVisita(v.id)
          }
        }

        await cargarInformes()
      } catch (err) {
        console.error('Error cargando proyecto:', err)
      }
    }
    load()
  }, [id])

  const crearVisita = async () => {
    try {
      // Check for existing borrador
      try {
        const apiRes = await reportesService.list({ proyecto_id: id })
        const all = apiRes.data?.data || apiRes.data || []
        const borrador = all.find(r => r.estado === 'borrador')
        if (borrador) {
          setModal({
            isOpen: true,
            title: 'Borrador en proceso',
            message: 'Ya existe un borrador en proceso. Termina o elimina ese primero.',
            type: 'alert',
            onConfirm: null
          })
          return
        }
      } catch (apiErr) {
        // If API fails, check local storage for pending borradores
        const pendingBorrador = syncService.getPending()
          .find(p => p.proyecto_id === id && p.reporte_estado === 'borrador')
        if (pendingBorrador) {
          setModal({
            isOpen: true,
            title: 'Borrador en proceso',
            message: 'Ya existe un borrador en proceso. Termina o elimina ese primero.',
            type: 'alert',
            onConfirm: null
          })
          return
        }
      }

      // El borrador se crea recién al guardar, con el id del servidor: no se
      // escribe nada local para no terminar con dos registros del mismo informe
      setShowNuevaVisita(false)
      navigate(`/tech/checklist/${id}`, { state: { fecha } })
    } catch (err) {
      console.error('Error creando visita:', err)
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'Error al crear la visita',
        type: 'alert',
        onConfirm: null
      })
    }
  }

  const openVisita = (visita) => {
    navigate(visita.id ? `/tech/checklist/${id}/${visita.id}` : `/tech/checklist/${id}`)
  }

  const deleteVisita = async (visita) => {
    setModal({
      isOpen: true,
      title: 'Eliminar borrador',
      message: '¿Estás seguro que deseas eliminar este borrador?',
      type: 'confirm',
      onConfirm: async () => {
        try {
          if (visita.id) await reportesService.delete(visita.id)
          await cargarInformes()
        } catch (err) {
          console.error('Error eliminando informe:', err)
          setModal({
            isOpen: true,
            title: 'Error',
            message: 'Error al eliminar el informe',
            type: 'alert',
            onConfirm: null
          })
        }
      }
    })
  }

  if (!proyecto) return <div className="p-4 text-center text-gray-400">Cargando...</div>

  const tipoLabels = { on_grid: 'On-Grid', off_grid: 'Off-Grid', hibrido: 'Híbrido' }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/tech/dashboard')} className="flex items-center gap-1 -ml-1 px-2 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-gray-800 text-sm truncate flex-1">{proyecto.nombre}</h1>
          {!isOnline && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-50 text-red-600 rounded-full text-[10px] font-medium shrink-0">
              <WifiOffIcon className="w-3 h-3" /> Sin conexión
            </span>
          )}
        </div>
      </header>

      <main className="px-4 py-4 pb-20">
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-1 bg-primary-50 text-primary-700 rounded-lg text-xs font-medium">{tipoLabels[proyecto.tipo_sistema]}</span>
            {proyecto.plantilla && (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs">📄 {proyecto.plantilla.nombre}</span>
            )}
          </div>
          <p className="text-sm text-gray-600">{proyecto.cliente}</p>
          <p className="text-xs text-gray-400 mt-1">{proyecto.direccion}</p>
        </div>

        <button onClick={() => setShowNuevaVisita(true)}
          className="w-full py-3 bg-primary-600 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-transform mb-4">
          <PlusIcon className="w-4 h-4" /> Llenar Informe
        </button>

        <h3 className="text-sm font-semibold text-gray-700 mb-2">Informes Anteriores</h3>
        {visitas.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
            <p className="text-gray-400 text-sm">Sin informes aún</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visitas.map((v) => {
              const isDraft = v.estado === 'pendiente' || v.estado === 'en_progreso'
              return (
                <div key={v.id}
                  className={`bg-white rounded-xl p-3 shadow-sm flex items-center justify-between ${isDraft ? 'border border-yellow-200' : ''}`}>
                  <button onClick={() => openVisita(v)} className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-800">{v.fecha}</p>
                    <p className="text-xs text-gray-500">
                      {v.estado === 'finalizada' ? 'Completado' : isDraft ? 'Borrador - Toca para editar' : v.estado}
                    </p>
                  </button>
                  <div className="flex items-center gap-1">
                    <span className={`p-1.5 rounded-lg ${v.estado === 'finalizada' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {v.estado === 'finalizada' ? <CheckCircleIcon className="w-4 h-4" /> : <ClockIcon className="w-4 h-4" />}
                    </span>
                    {isDraft && (
                      <button onClick={() => deleteVisita(v)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {showNuevaVisita && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
          <div className="bg-white rounded-t-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Nuevo Informe</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowNuevaVisita(false)}
                className="flex-1 py-3 text-gray-600 border border-gray-200 rounded-xl text-sm font-medium">Cancelar</button>
              <button onClick={crearVisita}
                className="flex-1 py-3 bg-primary-600 text-white rounded-xl text-sm font-medium">Crear</button>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        confirmText={modal.type === 'confirm' ? 'Eliminar' : 'Aceptar'}
        onClose={() => setModal({ ...modal, isOpen: false })}
        onConfirm={modal.onConfirm}
      />
    </div>
  )
}
