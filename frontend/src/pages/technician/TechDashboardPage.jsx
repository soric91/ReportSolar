import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/useAuthStore'
import { db } from '../../services/db'
import { syncService } from '../../services/syncService'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { SunIcon, RefreshIcon, LogoutIcon, PackageIcon, SendIcon, ChevronRightIcon, WifiOffIcon, SpinnerIcon } from '../../components/icons'

export default function TechDashboardPage() {
  const [proyectos, setProyectos] = useState([])
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const syncProyectos = syncService.syncProyectos
  const navigate = useNavigate()
  const isOnline = useOnlineStatus()

  const loadData = async () => {
    try {
      const local = await db.getProyectos()
      setProyectos(local)
      setPendingCount(syncService.getPendingCount())
    } catch (err) {
      console.error('Error cargando datos:', err)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await syncProyectos()
      await syncService.syncAll()
      loadData()
    } catch (err) {
      console.error('Error en sync:', err)
    } finally {
      setSyncing(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    localStorage.removeItem('solar-pending-sync')
    localStorage.removeItem('solar-sync-status')
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center text-primary-600">
              <SunIcon />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-bold text-gray-800">{user?.nombre}</h1>
                {!isOnline && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-50 text-red-600 rounded-full text-[10px] font-medium">
                    <WifiOffIcon className="w-3 h-3" /> Sin conexión
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">Técnico</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors">
            <LogoutIcon className="w-4 h-4" /> Salir
          </button>
        </div>
      </header>

      <main className="px-4 py-4 pb-20">
        <button onClick={handleSync} disabled={syncing}
          className="w-full py-3 bg-primary-600 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-transform mb-4 disabled:opacity-60">
          {syncing ? (
            <><SpinnerIcon className="w-4 h-4" /> Sincronizando...</>
          ) : (
            <><RefreshIcon className="w-4 h-4" /> Descargar Proyectos</>
          )}
        </button>

        {pendingCount > 0 && (
          <div className="mb-4 px-3 py-2.5 bg-orange-50 text-orange-700 rounded-xl text-xs flex items-center justify-center gap-1.5">
            <SendIcon className="w-3.5 h-3.5" /> {pendingCount} informe{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''} de enviar
          </div>
        )}

        <h2 className="text-lg font-bold text-gray-800 mb-3">Mis Proyectos</h2>

        {proyectos.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <PackageIcon className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 text-sm">Sin proyectos</p>
            <p className="text-gray-400 text-xs mt-1">Presiona "Descargar Proyectos"</p>
          </div>
        ) : (
          <div className="space-y-3">
            {proyectos.map((p) => (
              <button key={p.id} onClick={() => navigate(`/tech/proyecto/${p.id}`)}
                className="w-full bg-white rounded-2xl p-4 shadow-sm text-left active:scale-[0.98] transition-transform">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 text-sm truncate">{p.nombre}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{p.cliente}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{p.direccion}</p>
                    <span className="inline-block mt-1.5 px-2 py-1 bg-primary-50 text-primary-700 rounded-lg text-xs font-medium">
                      {p.tipo_sistema === 'on_grid' ? 'On-Grid' : p.tipo_sistema === 'off_grid' ? 'Off-Grid' : 'Híbrido'}
                    </span>
                  </div>
                  <ChevronRightIcon className="w-5 h-5 text-gray-300 shrink-0 ml-2" />
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
