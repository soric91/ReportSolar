from datetime import date, datetime

import pytest

from app.services.docx_generator import DocxGenerator, formatear_fecha


class TestFormatearFecha:
    """El created_at del reporte llega como datetime desde SQLAlchemy"""

    def test_datetime(self):
        assert formatear_fecha(datetime(2026, 7, 24, 15, 30, 0)) == "2026-07-24"

    def test_date(self):
        assert formatear_fecha(date(2026, 7, 24)) == "2026-07-24"

    def test_texto_iso(self):
        assert formatear_fecha("2026-07-24T15:30:00Z") == "2026-07-24"

    @pytest.mark.parametrize("vacio", [None, ""])
    def test_sin_valor(self, vacio):
        assert formatear_fecha(vacio) == ""


class TestDocxGenerator:
    PROYECTO = {
        "nombre": "Planta Test",
        "cliente": "Cliente Test",
        "direccion": "Calle Falsa 123",
        "tipo_sistema": "on_grid",
        "potencia": "5.5",
    }

    def test_add_project_info_acepta_datetime(self):
        """Regresión: se hacía [:10] sobre el datetime en vez de sobre su texto,
        y el export fallaba con 500 (TypeError: not subscriptable)"""
        generator = DocxGenerator()
        reporte = {"created_at": datetime(2026, 7, 24), "tecnico_nombre": "Técnico Test"}

        generator.add_project_info(self.PROYECTO, reporte)

        texto = "\n".join(
            celda.text for tabla in generator.doc.tables for fila in tabla.rows for celda in fila.cells
        )
        assert "2026-07-24" in texto
        assert "Técnico Test" in texto

    def test_add_project_info_sin_fecha(self):
        generator = DocxGenerator()
        generator.add_project_info(self.PROYECTO, {"tecnico_nombre": ""})
        assert generator.generate()

    def test_export_completo_produce_un_docx(self):
        generator = DocxGenerator()
        generator.add_header_with_logo(self.PROYECTO)
        generator.add_project_info(
            self.PROYECTO, {"created_at": datetime(2026, 7, 24), "tecnico_nombre": "Técnico Test"}
        )
        generator.add_section(
            {"titulo": "Módulos", "icono": "☀️", "campos": [{"nombre": "Limpieza", "sin_fotos": True}]},
            {"Limpieza": "OK"},
            [],
        )

        contenido = generator.generate()
        # Un .docx es un zip: empieza con la firma PK
        assert contenido[:2] == b"PK"
        assert len(contenido) > 0
