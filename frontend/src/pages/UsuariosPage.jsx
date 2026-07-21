import { useState, useEffect } from 'react'
import { usuariosService } from '../services/usuariosService'

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordUserId, setPasswordUserId] = useState(null)
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'tecnico' })
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')

  const loadUsuarios = async () => {
    try {
      const res = await usuariosService.list()
      // Manejar respuesta paginada
      const data = res.data?.data || res.data
      setUsuarios(Array.isArray(data) ? data : [])
    } catch (err) {
      setError('Error al cargar usuarios')
      setUsuarios([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsuarios() }, [])

  const openCreate = () => {
    setEditingUser(null)
    setForm({ nombre: '', email: '', password: '', rol: 'tecnico' })
    setShowModal(true)
  }

  const openEdit = (user) => {
    setEditingUser(user)
    setForm({ nombre: user.nombre, email: user.email, password: '', rol: user.rol })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      if (editingUser) {
        await usuariosService.update(editingUser.id, { nombre: form.nombre, email: form.email, rol: form.rol })
      } else {
        await usuariosService.create(form)
      }
      setShowModal(false)
      loadUsuarios()
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al guardar')
    }
  }

  const handleDeactivate = async (id) => {
    if (!confirm('¿Desactivar este usuario?')) return
    try {
      await usuariosService.deactivate(id)
      loadUsuarios()
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al desactivar')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este usuario permanentemente? Esta acción no se puede deshacer.')) return
    try {
      await usuariosService.delete(id)
      loadUsuarios()
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al eliminar')
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    try {
      await usuariosService.resetPassword(passwordUserId, newPassword)
      setShowPasswordModal(false)
      setNewPassword('')
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al restablecer contraseña')
    }
  }

  if (loading) return <div className="text-center py-8">Cargando...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-4 lg:mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-800">Usuarios</h1>
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
                <th className="text-left px-3 lg:px-4 py-2 lg:py-3 font-medium text-gray-600 text-xs lg:text-sm">Nombre</th>
                <th className="text-left px-3 lg:px-4 py-2 lg:py-3 font-medium text-gray-600 text-xs lg:text-sm hidden sm:table-cell">Email</th>
                <th className="text-left px-3 lg:px-4 py-2 lg:py-3 font-medium text-gray-600 text-xs lg:text-sm">Rol</th>
                <th className="text-left px-3 lg:px-4 py-2 lg:py-3 font-medium text-gray-600 text-xs lg:text-sm">Estado</th>
                <th className="text-left px-3 lg:px-4 py-2 lg:py-3 font-medium text-gray-600 text-xs lg:text-sm">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {usuarios.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-3 lg:px-4 py-2 lg:py-3">
                    <div className="text-xs lg:text-sm font-medium">{user.nombre}</div>
                    <div className="text-xs text-gray-500 sm:hidden">{user.email}</div>
                  </td>
                  <td className="px-3 lg:px-4 py-2 lg:py-3 text-gray-600 text-xs lg:text-sm hidden sm:table-cell">{user.email}</td>
                  <td className="px-3 lg:px-4 py-2 lg:py-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${user.rol === 'administrador' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {user.rol}
                    </span>
                  </td>
                  <td className="px-3 lg:px-4 py-2 lg:py-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${user.estado === 'activo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {user.estado}
                    </span>
                  </td>
                  <td className="px-3 lg:px-4 py-2 lg:py-3">
                    <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                      <button onClick={() => openEdit(user)} className="text-primary-600 hover:text-primary-800 text-xs">Editar</button>
                      <button onClick={() => { setPasswordUserId(user.id); setShowPasswordModal(true) }} className="text-yellow-600 hover:text-yellow-800 text-xs">Contraseña</button>
                      {user.estado === 'activo' && (
                        <button onClick={() => handleDeactivate(user.id)} className="text-orange-600 hover:text-orange-800 text-xs">Desactivar</button>
                      )}
                      <button onClick={() => handleDelete(user.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-xl sm:rounded-lg w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <h2 className="text-lg font-bold mb-4">{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input type="text" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" required />
                </div>
                {!editingUser && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                    <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" required />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                  <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm">
                    <option value="tecnico">Técnico</option>
                    <option value="administrador">Administrador</option>
                  </select>
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

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-xl sm:rounded-lg w-full sm:max-w-md">
            <div className="p-4 sm:p-6">
              <h2 className="text-lg font-bold mb-4">Restablecer Contraseña</h2>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" required />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowPasswordModal(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm">Cancelar</button>
                  <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm">Guardar</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
