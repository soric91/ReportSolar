from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from io import BytesIO
from pathlib import Path
import base64
import logging
from datetime import date, datetime

import httpx

logger = logging.getLogger(__name__)

EMPRESA = "PIVMAN SOLAR S.A.S"
LOGO_PATH = Path(__file__).resolve().parent.parent / "assets" / "logo_pivman.png"

# Paleta tomada del logo
NARANJA = RGBColor(0xE8, 0x62, 0x2A)
AMARILLO = RGBColor(0xF9, 0xC2, 0x18)
TEAL = RGBColor(0x35, 0xA9, 0xA9)
GRIS = RGBColor(0x58, 0x59, 0x5B)
GRIS_CLARO = RGBColor(0x8A, 0x8C, 0x8E)
BLANCO = RGBColor(0xFF, 0xFF, 0xFF)

# Los mismos colores en hexadecimal, para los sombreados de celda
HEX_NARANJA = "E8622A"
HEX_TEAL = "35A9A9"
HEX_GRIS_FONDO = "F4F5F6"
HEX_NARANJA_SUAVE = "FDF1EA"

TIPOS_SECUENCIA = ("antes", "durante", "despues")
ETIQUETA_TIPO = {"antes": "Antes", "durante": "Durante", "despues": "Después"}


def formatear_fecha(valor) -> str:
    """Fecha como YYYY-MM-DD, llegue como datetime o como texto ISO."""
    if not valor:
        return ""
    if isinstance(valor, (datetime, date)):
        return valor.strftime("%Y-%m-%d")
    return str(valor)[:10]


def _sombrear(celda, hex_color):
    """Color de fondo de una celda (python-docx no lo expone)."""
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:fill"), hex_color)
    celda._element.get_or_add_tcPr().append(shd)


def _sin_bordes(tabla):
    borders = OxmlElement("w:tblBorders")
    for lado in ("top", "left", "bottom", "right", "insideH", "insideV"):
        elem = OxmlElement(f"w:{lado}")
        elem.set(qn("w:val"), "none")
        borders.append(elem)
    tabla._element.tblPr.append(borders)


class DocxGenerator:
    def __init__(self, logo_url=None):
        self.logo_url = logo_url
        self.doc = Document()
        for seccion in self.doc.sections:
            seccion.top_margin = Inches(0.5)
            seccion.bottom_margin = Inches(0.5)
            seccion.left_margin = Inches(0.75)
            seccion.right_margin = Inches(0.75)
        self._cache_imagenes = {}
        self._aplicar_estilo_base()

    def _aplicar_estilo_base(self):
        estilo = self.doc.styles["Normal"]
        estilo.font.name = "Calibri"
        estilo.font.size = Pt(10)
        estilo.font.color.rgb = GRIS

    # ------------------------------------------------------------------ logo

    def _bytes_logo(self, logo_data=None):
        if logo_data:
            return logo_data
        try:
            return LOGO_PATH.read_bytes()
        except OSError as e:
            logger.warning(f"No se pudo leer el logo: {e}")
            return None

    def add_header_with_logo(self, proyecto, logo_data=None):
        """Encabezado con el logo de la empresa y el nombre del proyecto"""
        tabla = self.doc.add_table(rows=1, cols=2)
        _sin_bordes(tabla)
        tabla.autofit = False

        celda_logo = tabla.rows[0].cells[0]
        celda_logo.width = Inches(2.6)
        celda_logo.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        celda_logo.text = ""
        p = celda_logo.paragraphs[0]

        logo = self._bytes_logo(logo_data)
        if logo:
            try:
                p.add_run().add_picture(BytesIO(logo), width=Inches(2.3))
            except Exception as e:
                logger.warning(f"No se pudo insertar el logo: {e}")
                logo = None
        if not logo:
            run = p.add_run(EMPRESA)
            run.bold = True
            run.font.size = Pt(14)
            run.font.color.rgb = NARANJA

        celda_titulo = tabla.rows[0].cells[1]
        celda_titulo.width = Inches(4.4)
        celda_titulo.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        celda_titulo.text = ""
        p = celda_titulo.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.RIGHT

        run = p.add_run("INFORME DE MANTENIMIENTO\n")
        run.bold = True
        run.font.size = Pt(14)
        run.font.color.rgb = NARANJA

        run = p.add_run("Sistema Fotovoltaico\n")
        run.font.size = Pt(10.5)
        run.font.color.rgb = TEAL

        run = p.add_run(proyecto.get("nombre", "N/A"))
        run.bold = True
        run.font.size = Pt(11)
        run.font.color.rgb = GRIS

        self._add_separator()

    # -------------------------------------------------------- datos generales

    def add_project_info(self, proyecto, reporte):
        """Ficha de datos del proyecto en dos columnas"""
        self._titulo_bloque("Datos del Proyecto")

        datos = [
            ("Cliente", proyecto.get("cliente", "")),
            ("Dirección", proyecto.get("direccion", "")),
            ("Tipo de Sistema", proyecto.get("tipo_sistema", "")),
            ("Potencia (kW)", proyecto.get("potencia", "")),
            ("Fecha de Visita", formatear_fecha(reporte.get("created_at"))),
            ("Técnico", reporte.get("tecnico_nombre", "")),
        ]

        # Dos pares etiqueta/valor por fila para que ocupe la mitad de alto
        tabla = self.doc.add_table(rows=0, cols=4)
        _sin_bordes(tabla)
        for i in range(0, len(datos), 2):
            fila = tabla.add_row()
            for j, (etiqueta, valor) in enumerate(datos[i:i + 2]):
                celda_et = fila.cells[j * 2]
                celda_val = fila.cells[j * 2 + 1]
                _sombrear(celda_et, HEX_GRIS_FONDO)
                _sombrear(celda_val, HEX_GRIS_FONDO)

                celda_et.text = ""
                run = celda_et.paragraphs[0].add_run(etiqueta.upper())
                run.bold = True
                run.font.size = Pt(8)
                run.font.color.rgb = GRIS_CLARO

                celda_val.text = ""
                run = celda_val.paragraphs[0].add_run(str(valor) if valor else "—")
                run.font.size = Pt(10)
                run.font.color.rgb = GRIS

        self.doc.add_paragraph()

    # -------------------------------------------------------------- secciones

    def _titulo_bloque(self, texto, icono=""):
        """Barra de título con el naranja de la marca"""
        tabla = self.doc.add_table(rows=1, cols=1)
        _sin_bordes(tabla)
        celda = tabla.rows[0].cells[0]
        _sombrear(celda, HEX_NARANJA)
        celda.text = ""
        p = celda.paragraphs[0]
        run = p.add_run(f"{icono} {texto}".strip())
        run.bold = True
        run.font.size = Pt(11.5)
        run.font.color.rgb = BLANCO

    def add_section(self, section_def, section_data, fotos):
        """Sección del checklist con sus campos y fotos"""
        if not section_data or len(section_data) == 0:
            return

        self._titulo_bloque(section_def.get("titulo", ""), section_def.get("icono", ""))

        campos = section_def.get("campos") or []
        nombres = [c.get("nombre", "") for c in campos]
        # Los campos que no estén en la plantilla igual se muestran, al final
        extras = [k for k in section_data.keys() if k not in nombres]

        filas = [(n, section_data.get(n)) for n in nombres if section_data.get(n)]
        filas += [(k, section_data.get(k)) for k in extras if section_data.get(k)]

        if filas:
            tabla = self.doc.add_table(rows=0, cols=2)
            _sin_bordes(tabla)
            for i, (etiqueta, valor) in enumerate(filas):
                fila = tabla.add_row()
                celda_et, celda_val = fila.cells[0], fila.cells[1]
                celda_et.width = Inches(2.2)
                if i % 2 == 0:
                    _sombrear(celda_et, HEX_GRIS_FONDO)
                    _sombrear(celda_val, HEX_GRIS_FONDO)

                celda_et.text = ""
                run = celda_et.paragraphs[0].add_run(str(etiqueta))
                run.bold = True
                run.font.size = Pt(9.5)
                run.font.color.rgb = TEAL

                celda_val.text = ""
                run = celda_val.paragraphs[0].add_run(self._texto_valor(valor))
                run.font.size = Pt(10)

        self._add_photos_for_section(fotos)
        self.doc.add_paragraph()

    def _texto_valor(self, valor):
        """Los grupos de medidas llegan como dict: se aplanan a una línea"""
        if isinstance(valor, dict):
            return "   ".join(f"{k}: {v}" for k, v in valor.items() if v not in (None, ""))
        if isinstance(valor, list):
            return ", ".join(str(v) for v in valor)
        return str(valor)

    # ----------------------------------------------------------------- fotos

    def _descargar_imagen(self, url):
        """Bytes de la imagen: data URI o descarga desde Supabase"""
        if not url:
            return None
        if url in self._cache_imagenes:
            return self._cache_imagenes[url]

        datos = None
        try:
            if url.startswith("data:"):
                datos = base64.b64decode(url.split(",", 1)[1])
            elif url.startswith(("http://", "https://")):
                resp = httpx.get(url, timeout=30, follow_redirects=True)
                resp.raise_for_status()
                datos = resp.content
            else:
                logger.warning(f"URL de foto no reconocida: {url[:60]}")
        except Exception as e:
            logger.warning(f"No se pudo obtener la foto {url[:60]}: {e}")

        self._cache_imagenes[url] = datos
        return datos

    def _insertar_foto(self, parrafo, foto, ancho):
        datos = self._descargar_imagen(foto.get("url"))
        if datos:
            try:
                parrafo.add_run().add_picture(BytesIO(datos), width=ancho)
                return True
            except Exception as e:
                logger.warning(f"No se pudo insertar la foto: {e}")

        run = parrafo.add_run("Foto no disponible")
        run.italic = True
        run.font.size = Pt(8)
        run.font.color.rgb = GRIS_CLARO
        return False

    def _add_photos_for_section(self, fotos):
        """Fotos de la sección: la secuencia antes/durante/después y el resto"""
        if not fotos:
            return

        secuencia = {t: [f for f in fotos if f.get("tipo") == t] for t in TIPOS_SECUENCIA}
        sueltas = [f for f in fotos if f.get("tipo") not in TIPOS_SECUENCIA]

        if any(secuencia.values()):
            tabla = self.doc.add_table(rows=1, cols=3)
            _sin_bordes(tabla)
            for celda, tipo in zip(tabla.rows[0].cells, TIPOS_SECUENCIA):
                _sombrear(celda, HEX_TEAL)
                celda.text = ""
                p = celda.paragraphs[0]
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                run = p.add_run(ETIQUETA_TIPO[tipo])
                run.bold = True
                run.font.size = Pt(9)
                run.font.color.rgb = BLANCO

            fila = tabla.add_row()
            for celda, tipo in zip(fila.cells, TIPOS_SECUENCIA):
                _sombrear(celda, HEX_NARANJA_SUAVE)
                celda.text = ""
                p = celda.paragraphs[0]
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                if not secuencia[tipo]:
                    run = p.add_run("—")
                    run.font.color.rgb = GRIS_CLARO
                for foto in secuencia[tipo]:
                    self._insertar_foto(p, foto, Inches(1.9))

        if sueltas:
            columnas = 3
            tabla = self.doc.add_table(rows=0, cols=columnas)
            _sin_bordes(tabla)
            for i in range(0, len(sueltas), columnas):
                fila = tabla.add_row()
                for celda, foto in zip(fila.cells, sueltas[i:i + columnas]):
                    celda.text = ""
                    p = celda.paragraphs[0]
                    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    self._insertar_foto(p, foto, Inches(1.9))

    # ----------------------------------------------------------------- varios

    def _add_field(self, label, value):
        p = self.doc.add_paragraph()
        run = p.add_run(f"{label}: ")
        run.bold = True
        run.font.color.rgb = TEAL
        p.add_run(self._texto_valor(value))

    def add_texto_libre(self, titulo, texto, icono=""):
        """Bloques de observaciones y recomendaciones"""
        if not texto:
            return
        self._titulo_bloque(titulo, icono)
        p = self.doc.add_paragraph()
        run = p.add_run(str(texto))
        run.font.size = Pt(10)
        self.doc.add_paragraph()

    def add_firma(self, tecnico_nombre, firma_url=None):
        """Pie con la firma del técnico"""
        self._titulo_bloque("Firma y Validación")
        if firma_url:
            p = self.doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            self._insertar_foto(p, {"url": firma_url}, Inches(2.2))
        p = self.doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(f"\n{tecnico_nombre or ''}\nTécnico responsable · {EMPRESA}")
        run.font.size = Pt(9)
        run.font.color.rgb = GRIS_CLARO

    def _add_separator(self):
        p = self.doc.add_paragraph()
        pPr = p._element.get_or_add_pPr()
        pBdr = OxmlElement("w:pBdr")
        bottom = OxmlElement("w:bottom")
        bottom.set(qn("w:val"), "single")
        bottom.set(qn("w:sz"), "18")
        bottom.set(qn("w:space"), "1")
        bottom.set(qn("w:color"), HEX_NARANJA)
        pBdr.append(bottom)
        pPr.append(pBdr)

    def generate(self):
        """Retorna bytes del documento DOCX"""
        output = BytesIO()
        self.doc.save(output)
        output.seek(0)
        return output.getvalue()
