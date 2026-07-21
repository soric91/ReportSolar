from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import datetime, timedelta
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.usuario import Usuario, RolEnum
from app.models.proyecto import Proyecto
from app.models.visita import Visita
from app.models.reporte import Reporte
from app.models.plantilla import PlantillaInforme

router = APIRouter(prefix="/api/stats", tags=["Estadísticas"])


@router.get("/dashboard")
def dashboard_stats(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    total_proyectos = db.query(Proyecto).count()
    total_tecnicos = db.query(Usuario).filter(Usuario.rol == RolEnum.tecnico).count()
    total_reportes = db.query(Reporte).count()
    total_visitas = db.query(Visita).count()

    visitas_pendientes = db.query(Visita).filter(Visita.estado == "pendiente").count()
    visitas_progreso = db.query(Visita).filter(Visita.estado == "en_progreso").count()
    visitas_finalizadas = db.query(Visita).filter(Visita.estado == "finalizada").count()

    reportes_sync = (
        db.query(Reporte).filter(Reporte.estado_sync == "sincronizado").count()
    )
    reportes_local = db.query(Reporte).filter(Reporte.estado_sync == "local").count()

    now = datetime.now()
    meses = []
    for i in range(5, -1, -1):
        fecha = now - timedelta(days=30 * i)
        mes = fecha.month
        anio = fecha.year
        count = (
            db.query(Reporte)
            .filter(
                extract("month", Reporte.created_at) == mes,
                extract("year", Reporte.created_at) == anio,
            )
            .count()
        )
        meses.append(
            {
                "mes": fecha.strftime("%b %Y"),
                "reportes": count,
            }
        )

    reportes_por_tecnico = (
        db.query(Usuario.nombre, func.count(Reporte.id))
        .join(Reporte, Usuario.id == Reporte.tecnico_id)
        .group_by(Usuario.nombre)
        .all()
    )

    reportes_por_proyecto = (
        db.query(Proyecto.nombre, func.count(Reporte.id))
        .join(Reporte, Proyecto.id == Reporte.proyecto_id)
        .group_by(Proyecto.nombre)
        .order_by(func.count(Reporte.id).desc())
        .limit(10)
        .all()
    )

    tecnicos_status = []
    tecnicos = db.query(Usuario).filter(Usuario.rol == RolEnum.tecnico).all()
    for t in tecnicos:
        t_visitas = db.query(Visita).filter(Visita.tecnico_id == t.id).count()
        t_finalizadas = (
            db.query(Visita)
            .filter(Visita.tecnico_id == t.id, Visita.estado == "finalizada")
            .count()
        )
        t_reportes = db.query(Reporte).filter(Reporte.tecnico_id == t.id).count()
        tecnicos_status.append(
            {
                "id": t.id,
                "nombre": t.nombre,
                "estado": t.estado.value,
                "visitas_total": t_visitas,
                "visitas_finalizadas": t_finalizadas,
                "reportes": t_reportes,
                "porcentaje_avance": round(
                    (t_finalizadas / t_visitas * 100) if t_visitas > 0 else 0, 1
                ),
            }
        )

    return {
        "resumen": {
            "total_proyectos": total_proyectos,
            "total_tecnicos": total_tecnicos,
            "total_reportes": total_reportes,
            "total_visitas": total_visitas,
            "visitas_pendientes": visitas_pendientes,
            "visitas_en_progreso": visitas_progreso,
            "visitas_finalizadas": visitas_finalizadas,
            "reportes_sincronizados": reportes_sync,
            "reportes_pendientes_sync": reportes_local,
        },
        "reportes_por_mes": meses,
        "reportes_por_tecnico": [
            {"tecnico": n, "reportes": c} for n, c in reportes_por_tecnico
        ],
        "reportes_por_proyecto": [
            {"proyecto": n, "reportes": c} for n, c in reportes_por_proyecto
        ],
        "tecnicos": tecnicos_status,
    }
