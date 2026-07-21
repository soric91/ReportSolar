from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.usuario import Usuario
from app.models.plantilla import PlantillaInforme
from app.schemas.plantilla import PlantillaCreate, PlantillaUpdate, PlantillaResponse

router = APIRouter(prefix="/api/plantillas", tags=["Plantillas de Informe"])

DEFAULT_SECCIONES = [
    {
        "id": "datos_proyecto",
        "titulo": "Datos del Proyecto",
        "icono": "📁",
        "campos": [
            {"nombre": "Cliente", "tipo": "texto", "placeholder": "Nombre del cliente", "sin_fotos": True},
            {"nombre": "Dirección", "tipo": "texto", "placeholder": "Ubicación", "sin_fotos": True},
            {"nombre": "Tipo de Sistema", "tipo": "select", "opciones": ["On-Grid", "Off-Grid", "Híbrido"], "sin_fotos": True},
            {"nombre": "Potencia (kW)", "tipo": "numero", "placeholder": "kW", "step": "0.1", "sin_fotos": True},
            {"nombre": "Cantidad de Inversores", "tipo": "numero", "placeholder": "Número", "step": "1", "sin_fotos": True},
            {"nombre": "Fecha de Visita", "tipo": "fecha", "sin_fotos": True},
            {"nombre": "Técnico", "tipo": "texto", "placeholder": "Nombre", "sin_fotos": True},
        ],
    },
    {
        "id": "modulos",
        "titulo": "Módulos Fotovoltaicos",
        "icono": "☀️",
        "campos": [
            {"nombre": "Limpieza de módulos", "tipo": "estado", "foto_requerida": True},
            {"nombre": "Daños visibles (grietas, manchas)", "tipo": "estado", "foto_requerida": True},
            {"nombre": "Decoloración o amarillamiento", "tipo": "estado", "foto_requerida": True},
            {"nombre": "Notas", "tipo": "textarea", "placeholder": "Observaciones...", "sin_fotos": True},
        ],
    },
    {
        "id": "estructura",
        "titulo": "Estructura de Soporte",
        "icono": "🏗️",
        "campos": [
            {"nombre": "Estado general de estructura", "tipo": "estado", "foto_requerida": True},
            {"nombre": "Corrosión o oxidación", "tipo": "estado", "foto_requerida": True},
            {"nombre": "Anclajes firmes", "tipo": "estado", "foto_requerida": True},
            {"nombre": "Notas", "tipo": "textarea", "placeholder": "Observaciones...", "sin_fotos": True},
        ],
    },
    {
        "id": "inversores",
        "titulo": "Inversores",
        "icono": "⚡",
        "dinamico_inversores": True,
        "campos": [
            {"nombre": "Funcionamiento", "tipo": "estado", "foto_requerida": True},
            {"nombre": "Conexiones (entrada/salida)", "tipo": "estado", "foto_requerida": True},
            {"nombre": "Temperatura (°C)", "tipo": "numero", "placeholder": "°C", "step": "0.1", "sin_fotos": True},
            {"nombre": "Códigos de error", "tipo": "texto", "placeholder": "Sin errores", "sin_fotos": True},
        ],
    },
    {
        "id": "medidas_dc",
        "titulo": "Medidas DC",
        "icono": "🔋",
        "dinamico_inversores": True,
        "campos": [
            {
                "nombre": "Voltajes por String",
                "tipo": "grupo_strings",
                "strings_por_inversor": 6,
                "sin_fotos": True,
            },
            {"nombre": "Foto de mediciones", "tipo": "estado", "foto_requerida": True},
        ],
    },
    {
        "id": "medidas_ac",
        "titulo": "Medidas AC",
        "icono": "🔌",
        "dinamico_inversores": True,
        "campos": [
            {
                "nombre": "Voltajes AC",
                "tipo": "grupo_voltajes",
                "sub_campos": [
                    {"nombre": "L1-L2 (V)", "tipo": "ac"},
                    {"nombre": "L1-N (V)", "tipo": "ac"},
                    {"nombre": "Frecuencia (Hz)", "tipo": "ac"},
                ],
                "sin_fotos": True,
            },
            {"nombre": "Foto de mediciones", "tipo": "estado", "foto_requerida": True},
        ],
    },
    {
        "id": "protecciones",
        "titulo": "Protecciones",
        "icono": "🛡️",
        "campos": [
            {"nombre": "Seccionadores (DC/AC)", "tipo": "estado", "foto_requerida": True},
            {"nombre": "Breakers y diferenciales", "tipo": "estado", "foto_requerida": True},
            {"nombre": "SPD/Descargadores", "tipo": "estado", "foto_requerida": True},
            {"nombre": "Notas", "tipo": "textarea", "placeholder": "Observaciones...", "sin_fotos": True},
        ],
    },
    {
        "id": "puesta_tierra",
        "titulo": "Puesta a Tierra",
        "icono": "🌍",
        "campos": [
            {"nombre": "Continuidad de tierra", "tipo": "estado", "sin_fotos": True},
            {"nombre": "Resistencia (Ω)", "tipo": "numero", "placeholder": "Ω", "step": "0.1", "sin_fotos": True},
        ],
    },
    {
        "id": "cableado",
        "titulo": "Cableado",
        "icono": "📡",
        "campos": [
            {"nombre": "Estado del cableado", "tipo": "estado", "foto_requerida": True},
            {"nombre": "Aislamiento íntegro", "tipo": "estado", "foto_requerida": True},
            {"nombre": "Orden y etiquetado", "tipo": "estado", "foto_requerida": True},
            {"nombre": "Notas", "tipo": "textarea", "placeholder": "Observaciones...", "sin_fotos": True},
        ],
    },
    {
        "id": "produccion",
        "titulo": "Producción",
        "icono": "📊",
        "campos": [
            {"nombre": "Producción Hoy (kWh)", "tipo": "numero", "placeholder": "kWh", "step": "0.1", "sin_fotos": True},
            {"nombre": "Producción Este Mes (kWh)", "tipo": "numero", "placeholder": "kWh", "step": "1", "sin_fotos": True},
            {"nombre": "Notas", "tipo": "textarea", "placeholder": "Observaciones...", "sin_fotos": True},
        ],
    },
]


@router.get("/default-secciones")
def get_default_secciones(
    current_user: Usuario = Depends(get_current_user),
):
    return {"secciones": DEFAULT_SECCIONES}


@router.get("/", response_model=List[PlantillaResponse])
def list_plantillas(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_role(["administrador"])),
):
    return db.query(PlantillaInforme).all()


@router.get("/{plantilla_id}", response_model=PlantillaResponse)
def get_plantilla(
    plantilla_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_role(["administrador"])),
):
    plantilla = (
        db.query(PlantillaInforme).filter(PlantillaInforme.id == plantilla_id).first()
    )
    if not plantilla:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    return plantilla


@router.post("/", response_model=PlantillaResponse, status_code=201)
def create_plantilla(
    plantilla: PlantillaCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_role(["administrador"])),
):
    data = plantilla.model_dump()
    if not data.get("secciones"):
        data["secciones"] = DEFAULT_SECCIONES

    db_plantilla = PlantillaInforme(**data)
    db.add(db_plantilla)
    db.commit()
    db.refresh(db_plantilla)
    return db_plantilla


@router.put("/{plantilla_id}", response_model=PlantillaResponse)
def update_plantilla(
    plantilla_id: int,
    plantilla: PlantillaUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_role(["administrador"])),
):
    db_plantilla = (
        db.query(PlantillaInforme).filter(PlantillaInforme.id == plantilla_id).first()
    )
    if not db_plantilla:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")

    update_data = plantilla.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_plantilla, field, value)

    db.commit()
    db.refresh(db_plantilla)
    return db_plantilla


@router.delete("/{plantilla_id}", status_code=204)
def delete_plantilla(
    plantilla_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_role(["administrador"])),
):
    db_plantilla = (
        db.query(PlantillaInforme).filter(PlantillaInforme.id == plantilla_id).first()
    )
    if not db_plantilla:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    db.delete(db_plantilla)
    db.commit()
