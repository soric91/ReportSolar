import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'

export default function LoginPage() {
  const [rol, setRol] = useState('administrador')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useAuthStore((state) => state.login)
  const error = useAuthStore((state) => state.error)
  const clearError = useAuthStore((state) => state.clearError)
  const navigate = useNavigate()

  const handleChangeRol = (newRol) => {
    setRol(newRol)
    clearError()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    clearError()

    // Usar el nuevo store unificado
    const result = await login(email, password, rol)

    if (result.success) {
      navigate(rol === 'administrador' ? '/dashboard' : '/tech/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary-600 to-primary-800 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-3xl">☀️</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Solar Maintenance</h1>
          <p className="text-primary-200 text-sm mt-1">Sistema de Mantenimiento Fotovoltaico</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-xl">
          <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
            <button type="button" onClick={() => handleChangeRol('administrador')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${rol === 'administrador' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'}`}>
              👤 Administrador
            </button>
            <button type="button" onClick={() => handleChangeRol('tecnico')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${rol === 'tecnico' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'}`}>
              🔧 Técnico
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Correo electrónico</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-gray-50" required />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-gray-50" required />
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3 px-4 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 text-sm font-semibold shadow-md">
              {loading ? 'Ingresando...' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-xs text-gray-400">
              {rol === 'administrador' ? 'Acceso al panel de administración' : 'Acceso a proyectos asignados'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
