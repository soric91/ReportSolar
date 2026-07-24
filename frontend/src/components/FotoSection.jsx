import { CameraIcon, GalleryIcon, CheckIcon, XIcon } from './icons'
import { MODO_FOTOS, getModoFotos } from '../utils/plantillas'
import { ORIGEN_FOTO, fotosDeCampo } from '../utils/fotos'

const SLOTS_TRIPLE = [
  { tipo: 'antes', label: 'Antes', activo: 'bg-primary-100 text-primary-700 border-primary-300', borde: 'border-primary-300' },
  { tipo: 'durante', label: 'Durante', activo: 'bg-purple-100 text-purple-700 border-purple-300', borde: 'border-purple-300' },
  { tipo: 'despues', label: 'Después', activo: 'bg-green-100 text-green-700 border-green-300', borde: 'border-green-300' },
]

function Miniatura({ foto, alt, className, onDelete, botonClassName, iconClassName }) {
  return (
    <div className="relative w-full">
      <img src={foto.url} alt={alt} className={className} />
      {!foto.uploaded && (
        <span className="absolute top-0.5 left-0.5 bg-yellow-500 text-white text-[7px] px-0.5 rounded">local</span>
      )}
      <button onClick={() => onDelete(foto.id)} title={`Eliminar ${alt}`} aria-label={`Eliminar ${alt}`}
        className={botonClassName}>
        <XIcon className={iconClassName} />
      </button>
    </div>
  )
}

/**
 * Botones de carga y miniaturas de un campo del checklist.
 * El modo lo define la plantilla; `onSelect` recibe el tipo de foto y el
 * origen (cámara o galería) elegido por el técnico.
 */
export default function FotoSection({ secId, campo, fotos, onSelect, onDelete }) {
  const modo = getModoFotos(campo)
  if (modo === MODO_FOTOS.NINGUNA) return null

  const modoTriple = modo === MODO_FOTOS.TRIPLE
  const esMultiple = modo === MODO_FOTOS.MULTIPLE

  const campoFotos = fotosDeCampo(fotos, secId, campo.nombre)
  const fotoUnica = campoFotos.filter(f => f.tipo === 'foto_unica')

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <h5 className="text-xs font-bold text-gray-700 mb-3 flex items-center gap-1.5">
        <CameraIcon className="w-3.5 h-3.5" /> {modoTriple ? 'Fotos (Antes/Durante/Después)' : esMultiple ? 'Fotos' : 'Foto'}
      </h5>

      {modoTriple ? (
        <div className="grid grid-cols-3 gap-2">
          {SLOTS_TRIPLE.map(({ tipo, label, activo, borde }) => {
            const lista = campoFotos.filter(f => f.tipo === tipo)
            return (
              <div key={tipo} className="flex flex-col gap-1.5">
                <span className={`text-[11px] font-semibold text-center rounded-lg py-1 border flex items-center justify-center gap-1 ${
                  lista.length > 0 ? activo : 'bg-gray-50 text-gray-600 border-gray-300'
                }`}>
                  {lista.length > 0 && <CheckIcon className="w-3 h-3" />} {label}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => onSelect(tipo, { origen: ORIGEN_FOTO.CAMARA })}
                    title={`${label}: tomar foto`} aria-label={`${label}: tomar foto`}
                    className="flex-1 py-2 rounded-lg border border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100 flex items-center justify-center min-h-[36px] transition-all">
                    <CameraIcon className="w-4 h-4" />
                  </button>
                  <button onClick={() => onSelect(tipo, { origen: ORIGEN_FOTO.GALERIA })}
                    title={`${label}: elegir de galería`} aria-label={`${label}: elegir de galería`}
                    className="flex-1 py-2 rounded-lg border border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100 flex items-center justify-center min-h-[36px] transition-all">
                    <GalleryIcon className="w-4 h-4" />
                  </button>
                </div>
                {lista.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {lista.map((foto) => (
                      <Miniatura key={foto.id} foto={foto} alt={label} onDelete={onDelete}
                        className={`w-full h-16 object-cover rounded border-2 ${borde}`}
                        botonClassName="absolute -top-1.5 -right-1.5 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center shadow-md text-xs"
                        iconClassName="w-2.5 h-2.5" />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <button onClick={() => onSelect('foto_unica', { reemplazar: !esMultiple, origen: ORIGEN_FOTO.CAMARA })}
              className="flex-1 py-3 px-3 rounded-lg text-sm font-medium border transition-all flex items-center justify-center gap-2 min-h-[44px] bg-primary-50 text-primary-600 border-primary-300 hover:bg-primary-100">
              <CameraIcon className="w-4 h-4" /> Cámara
            </button>
            <button onClick={() => onSelect('foto_unica', { reemplazar: !esMultiple, origen: ORIGEN_FOTO.GALERIA })}
              className="flex-1 py-3 px-3 rounded-lg text-sm font-medium border transition-all flex items-center justify-center gap-2 min-h-[44px] bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100">
              <GalleryIcon className="w-4 h-4" /> Galería
            </button>
          </div>
          {fotoUnica.length > 0 && (
            <>
              <span className="text-[11px] font-medium text-green-600 flex items-center gap-1">
                <CheckIcon className="w-3 h-3" />
                {esMultiple
                  ? `${fotoUnica.length} foto${fotoUnica.length !== 1 ? 's' : ''} cargada${fotoUnica.length !== 1 ? 's' : ''}`
                  : 'Foto cargada · volver a cargar la reemplaza'}
              </span>
              <div className="flex gap-2 flex-wrap">
                {fotoUnica.map((foto) => (
                  <Miniatura key={foto.id} foto={foto} alt="foto" onDelete={onDelete}
                    className="w-20 h-20 object-cover rounded-lg border-2 border-green-300"
                    botonClassName="absolute -top-2 -right-2 bg-red-500 text-white w-7 h-7 rounded-full flex items-center justify-center shadow-md"
                    iconClassName="w-3.5 h-3.5" />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
