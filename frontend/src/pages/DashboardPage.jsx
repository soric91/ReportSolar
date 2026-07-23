import { useState, useEffect } from 'react'
import { statsService } from '../services/statsService'

export default function DashboardPage() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await statsService.getDashboard()
        setStats(res.data)
      } catch (err) {
        console.error('Error loading stats:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  if (loading) return <div className="text-center py-8">Cargando...</div>
  if (!stats) return <div className="text-center py-8 text-gray-400">Error al cargar datos</div>

  const { resumen, reportes_por_mes, reportes_por_tecnico, reportes_por_proyecto, tecnicos } = stats

  const maxReportes = Math.max(...reportes_por_mes.map(m => m.reportes), 1)

  return (
    <div>
      <h1 className="text-xl lg:text-2xl font-bold text-gray-800 mb-4 lg:mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4 mb-6 lg:mb-8">
        {[
          { label: 'Proyectos', value: resumen.total_proyectos, color: 'bg-primary-500' },
          { label: 'Técnicos', value: resumen.total_tecnicos, color: 'bg-green-500' },
          { label: 'Pendientes', value: resumen.visitas_pendientes, color: 'bg-yellow-500' },
          { label: 'En Progreso', value: resumen.visitas_en_progreso, color: 'bg-orange-500' },
          { label: 'Finalizadas', value: resumen.visitas_finalizadas, color: 'bg-emerald-500' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-lg shadow p-3 lg:p-4">
            <div className={`w-8 h-8 lg:w-10 lg:h-10 ${card.color} rounded-lg flex items-center justify-center text-white text-sm font-bold mb-2`}>
              {card.value}
            </div>
            <div className="text-xs lg:text-sm text-gray-600">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-medium text-gray-700 mb-3">Reportes por Mes</h3>
          <div className="flex items-end gap-2 h-40">
            {reportes_por_mes.map((mes, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <span className="text-xs text-gray-500 mb-1">{mes.reportes}</span>
                <div className="w-full bg-primary-100 rounded-t" style={{ height: `${(mes.reportes / maxReportes) * 100}%`, minHeight: mes.reportes > 0 ? '8px' : '2px' }}>
                  <div className="w-full h-full bg-primary-500 rounded-t"></div>
                </div>
                <span className="text-[10px] text-gray-400 mt-1 text-center">{mes.mes.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-medium text-gray-700 mb-3">Reportes por Técnico</h3>
          <div className="space-y-2">
            {reportes_por_tecnico.length === 0 ? (
              <p className="text-gray-400 text-sm text-center">Sin datos</p>
            ) : (
              reportes_por_tecnico.map((t, i) => {
                const maxT = Math.max(...reportes_por_tecnico.map(x => x.reportes), 1)
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-24 truncate">{t.tecnico}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-4">
                      <div className="bg-green-500 h-4 rounded-full flex items-center justify-end pr-2" style={{ width: `${(t.reportes / maxT) * 100}%` }}>
                        <span className="text-[10px] text-white font-medium">{t.reportes}</span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-medium text-gray-700 mb-3">Reportes por Proyecto</h3>
          <div className="space-y-2">
            {reportes_por_proyecto.length === 0 ? (
              <p className="text-gray-400 text-sm text-center">Sin datos</p>
            ) : (
              reportes_por_proyecto.map((p, i) => {
                const maxP = Math.max(...reportes_por_proyecto.map(x => x.reportes), 1)
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-28 truncate">{p.proyecto}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-4">
                      <div className="bg-primary-500 h-4 rounded-full flex items-center justify-end pr-2" style={{ width: `${(p.reportes / maxP) * 100}%` }}>
                        <span className="text-[10px] text-white font-medium">{p.reportes}</span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-medium text-gray-700 mb-3">Sincronización</h3>
          <div className="flex gap-4 mb-4">
            <div className="flex-1 bg-green-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{resumen.reportes_sincronizados}</div>
              <div className="text-xs text-green-700">Sincronizados</div>
            </div>
            <div className="flex-1 bg-orange-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-orange-600">{resumen.reportes_pendientes_sync}</div>
              <div className="text-xs text-orange-700">Pendientes</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b font-medium text-gray-700">Seguimiento de Técnicos</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs">Técnico</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs">Estado</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs">Visitas</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs">Avance</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs">Reportes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tecnicos.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-4 text-center text-gray-400">Sin técnicos</td></tr>
              ) : (
                tecnicos.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs font-medium">{t.nombre}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${t.estado === 'activo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{t.estado}</span>
                    </td>
                    <td className="px-3 py-2 text-xs">{t.visitas_finalizadas}/{t.visitas_total}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div className="bg-primary-500 h-2 rounded-full" style={{ width: `${t.porcentaje_avance}%` }}></div>
                        </div>
                        <span className="text-xs text-gray-500">{t.porcentaje_avance}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs">{t.reportes}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
