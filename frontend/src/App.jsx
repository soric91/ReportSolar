import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/useAuthStore'

import LoginPage from './pages/LoginPage'
import AdminLayout from './components/AdminLayout'
import DashboardPage from './pages/DashboardPage'
import UsuariosPage from './pages/UsuariosPage'
import ProyectosPage from './pages/ProyectosPage'
import ReportesPage from './pages/ReportesPage'
import PlantillasPage from './pages/PlantillasPage'

import TechDashboardPage from './pages/technician/TechDashboardPage'
import TechProyectoPage from './pages/technician/TechProyectoPage'
import TechChecklistPage from './pages/technician/TechChecklistPage'

function AdminRoute({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)
  if (!isAuthenticated) return <Navigate to="/login" />
  if (user?.rol !== 'administrador') return <Navigate to="/login" />
  return children
}

function TechRoute({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)
  if (!isAuthenticated) return <Navigate to="/login" />
  if (user?.rol !== 'tecnico') return <Navigate to="/login" />
  return children
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/tech/dashboard" element={<TechRoute><TechDashboardPage /></TechRoute>} />
        <Route path="/tech/proyecto/:id" element={<TechRoute><TechProyectoPage /></TechRoute>} />
        <Route path="/tech/checklist/:id" element={<TechRoute><TechChecklistPage /></TechRoute>} />
        <Route path="/tech/checklist/:id/:visitaId" element={<TechRoute><TechChecklistPage /></TechRoute>} />

        <Route path="/dashboard" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<DashboardPage />} />
        </Route>
        <Route path="/usuarios" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<UsuariosPage />} />
        </Route>
        <Route path="/proyectos" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<ProyectosPage />} />
        </Route>
        <Route path="/reportes" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<ReportesPage />} />
        </Route>
        <Route path="/plantillas" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<PlantillasPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
