import { XIcon } from './icons'

export default function Modal({ isOpen, title, message, onClose, onConfirm, confirmText = 'Aceptar', type = 'alert' }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-4">
          <p className="text-sm text-gray-600">{message}</p>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
          {type === 'confirm' && (
            <button onClick={onClose} className="flex-1 py-2 text-gray-600 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">
              Cancelar
            </button>
          )}
          <button onClick={() => { onConfirm?.(); onClose() }} className={`flex-1 py-2 rounded-lg text-sm font-medium text-white ${type === 'alert' ? 'bg-primary-600 hover:bg-primary-700' : 'bg-red-600 hover:bg-red-700'}`}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
