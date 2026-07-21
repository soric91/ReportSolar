import jsPDF from 'jspdf'

// Convierte URL de imagen a base64
async function urlToBase64(url) {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.readAsDataURL(blob)
    })
  } catch (err) {
    console.warn('No se pudo cargar imagen de URL:', url, err)
    return null
  }
}

const PDF_COLORS = {
  primary: [2, 132, 199],      // #0284c7
  secondary: [15, 23, 42],     // #0f172a
  accent: [34, 197, 94],       // #22c55e
  text: [31, 41, 55],          // #1f2937
  lightGray: [243, 244, 246],  // #f3f4f6
  border: [229, 231, 235],     // #e5e7eb
}

export const pdfGeneratorService = {
  async generatePDF(reporte, proyecto, secciones) {
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    let currentY = 15

    // Convierte todas las URLs de fotos a base64
    const fotosBase64 = await Promise.all(
      (reporte.fotos || []).map(async (foto) => ({
        ...foto,
        dataUrl: foto.url.startsWith('data:') ? foto.url : await urlToBase64(foto.url)
      }))
    )

    // 1. ENCABEZADO
    this.addHeader(pdf, pageWidth, proyecto)
    currentY = 50

    // 2. DATOS DEL PROYECTO
    currentY = this.addProjectInfo(pdf, currentY, pageWidth, proyecto, reporte)
    currentY += 10

    // 3. CONTENIDO POR SECCIONES
    const checklist = reporte.checklist || {}

    // Busca todas las secciones en el checklist (incluyendo expandidas)
    const seccionesEnChecklist = Object.keys(checklist).filter(k => k !== 'datos_proyecto')

    for (const seccionId of seccionesEnChecklist) {
      const seccionData = checklist[seccionId]
      if (!seccionData || Object.keys(seccionData).length === 0) continue

      // Encuentra la definición de la sección original
      const seccionDef = secciones.find(s =>
        s.id === seccionId || seccionId.startsWith(s.id + '_')
      )

      if (!seccionDef) {
        continue
      }


      // Salto de página si se acerca al final
      if (currentY > pageHeight - 50) {
        pdf.addPage()
        currentY = 15
      }

      // Título de sección
      currentY = this.addSectionTitle(pdf, currentY, pageWidth, seccionDef)
      currentY += 5

      // Campos de la sección
      for (const campo of seccionDef.campos) {
        const valor = seccionData[campo.nombre]

        // Omite campos vacíos
        if (!valor && valor !== 0) {
          continue
        }

        if (currentY > pageHeight - 40) {
          pdf.addPage()
          currentY = 15
        }

        // Pregunta y respuesta
        currentY = this.addFieldWithAnswer(pdf, currentY, pageWidth, campo, valor)

        // Fotos relacionadas - agrupadas por tipo en cuadrícula
        const campoFotos = fotosBase64.filter(f => f.checklist_item === `${seccionId}.${campo.nombre}`)
        if (campoFotos.length > 0) {
          // Agrupa por tipo (antes, después, etc)
          const fotosPorTipo = {}
          campoFotos.forEach(foto => {
            if (!fotosPorTipo[foto.tipo]) fotosPorTipo[foto.tipo] = []
            fotosPorTipo[foto.tipo].push(foto)
          })

          // Muestra cada tipo en cuadrícula
          for (const [tipo, fotos] of Object.entries(fotosPorTipo)) {
            if (currentY > pageHeight - 60) {
              pdf.addPage()
              currentY = 15
            }
            currentY = this.addPhotosGrid(pdf, currentY, pageWidth, tipo, fotos)
          }
        }

        currentY += 3
      }
    }

    // 4. OBSERVACIONES Y RECOMENDACIONES
    if (reporte.observaciones || reporte.recomendaciones) {
      if (currentY > pageHeight - 60) {
        pdf.addPage()
        currentY = 15
      }
      currentY = this.addObservations(pdf, currentY, pageWidth, reporte)
    }

    // 5. PIE DE PÁGINA
    this.addFooter(pdf, pageWidth, pageHeight)

    // GUARDAR
    const fileName = `Informe_${proyecto.nombre}_${new Date().toISOString().split('T')[0]}.pdf`
    pdf.save(fileName)
  },

  addHeader(pdf, pageWidth, proyecto) {
    const margin = 15

    // Fondo del encabezado
    pdf.setFillColor(...PDF_COLORS.primary)
    pdf.rect(0, 0, pageWidth, 40, 'F')

    // Título
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(24)
    pdf.setFont('helvetica', 'bold')
    pdf.text('INFORME DE INSPECCIÓN', margin, 15)

    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`SISTEMA FOTOVOLTAICO - ${proyecto.nombre}`, margin, 25)

    // Fecha
    const fecha = new Date().toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
    pdf.setFontSize(9)
    pdf.text(`Generado: ${fecha}`, pageWidth - margin - 50, 25)
  },

  addProjectInfo(pdf, startY, pageWidth, proyecto, reporte) {
    const margin = 15
    let y = startY

    // Recuadro de datos (aumentado para más campos)
    pdf.setDrawColor(...PDF_COLORS.border)
    pdf.setFillColor(...PDF_COLORS.lightGray)
    pdf.rect(margin, y, pageWidth - 2 * margin, 38, 'FD')

    pdf.setTextColor(...PDF_COLORS.text)
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'bold')

    pdf.text('DATOS DEL PROYECTO', margin + 3, y + 5)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    y += 10

    // Obtiene datos del checklist (datos_proyecto) o usa datos del proyecto
    const datosChecklist = reporte.checklist?.datos_proyecto || {}
    const datos = [
      `Cliente: ${datosChecklist['Cliente'] || proyecto.cliente || 'N/A'}`,
      `Dirección: ${datosChecklist['Dirección'] || proyecto.direccion || 'N/A'}`,
      `Potencia: ${datosChecklist['Potencia (kW)'] || proyecto.componentes?.potencia || 'N/A'} kW`,
      `Inversores: ${datosChecklist['Cantidad de Inversores'] || 'N/A'}`,
      `Tipo Sistema: ${datosChecklist['Tipo de Sistema'] || 'N/A'}`,
      `Técnico: ${datosChecklist['Técnico'] || reporte.tecnico_nombre || 'N/A'}`,
    ]

    datos.forEach((dato, idx) => {
      if (idx % 2 === 0) {
        pdf.text(dato, margin + 3, y + (idx / 2) * 5)
      } else {
        pdf.text(dato, pageWidth / 2, y + ((idx - 1) / 2) * 5)
      }
    })

    return startY + 38
  },

  addSectionTitle(pdf, startY, pageWidth, seccion) {
    const margin = 15

    pdf.setFillColor(...PDF_COLORS.primary)
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')

    pdf.rect(margin, startY, pageWidth - 2 * margin, 8, 'F')
    // No usar emojis en PDF (no se renderean correctamente)
    pdf.text(seccion.titulo, margin + 3, startY + 5.5)

    return startY + 10
  },

  addFieldWithAnswer(pdf, startY, pageWidth, campo, valor) {
    const margin = 15
    const contentWidth = pageWidth - 2 * margin
    const y = startY

    // Pregunta
    pdf.setTextColor(...PDF_COLORS.secondary)
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'bold')

    const preguntaLines = pdf.splitTextToSize(campo.nombre, contentWidth - 30)
    pdf.text(preguntaLines, margin + 2, y + 3)

    const preguntaHeight = preguntaLines.length * 4

    // Si es un objeto, dibuja tabla
    if (typeof valor === 'object' && valor !== null && !Array.isArray(valor)) {
      return this.addTableAnswer(pdf, startY + preguntaHeight + 2, pageWidth, valor)
    }

    // Respuesta normal
    pdf.setTextColor(...PDF_COLORS.text)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)

    let respuestaText = this.formatValue(valor)
    const respuestaLines = pdf.splitTextToSize(respuestaText, contentWidth - 4)

    pdf.setFillColor(...PDF_COLORS.lightGray)
    const respuestaHeight = respuestaLines.length * 4 + 2
    pdf.rect(margin, y + preguntaHeight + 2, contentWidth, respuestaHeight, 'F')

    pdf.text(respuestaLines, margin + 2, y + preguntaHeight + 5)

    return startY + preguntaHeight + respuestaHeight + 4
  },

  addTableAnswer(pdf, startY, pageWidth, datos) {
    const margin = 15
    const contentWidth = pageWidth - 2 * margin
    const barHeight = 8
    const labelWidth = 40

    let currentY = startY

    // Agrupa por unidad
    const datosAgrupados = {}
    Object.entries(datos).forEach(([key, val]) => {
      let unidad = key.match(/\(([^)]+)\)/)?.[1] || ''
      if (!unidad && (key.includes('inv') || key.includes('string') || key.includes('L'))) {
        unidad = 'V'
      }
      if (!datosAgrupados[unidad]) {
        datosAgrupados[unidad] = []
      }
      datosAgrupados[unidad].push({ key, val })
    })

    // Renderiza cada grupo de unidades
    Object.entries(datosAgrupados).forEach(([unidad, items]) => {
      // Título del grupo
      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(...PDF_COLORS.primary)
      const titulo = unidad === 'V' ? 'Voltajes (V)' : unidad === 'Hz' ? 'Frecuencia (Hz)' : `Valores (${unidad})`
      pdf.text(titulo, margin, currentY + 4)
      currentY += 6

      // Encuentra el valor máximo para este grupo
      const maxVal = Math.max(...items.map(i => parseFloat(i.val) || 0))
      const scale = (maxVal > 0) ? (contentWidth - labelWidth - 30) / maxVal : 1

      items.forEach(({ key, val }) => {
        const nombreLimpio = key.replace(/\s*\([^)]*\)/g, '').trim()
        const numVal = parseFloat(val) || 0

        // Etiqueta
        pdf.setFontSize(8)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(...PDF_COLORS.text)
        pdf.text(nombreLimpio, margin, currentY + barHeight - 1.5)

        // Barra de valor
        const barWidth = numVal * scale
        pdf.setFillColor(...PDF_COLORS.primary)
        pdf.rect(margin + labelWidth, currentY, barWidth, barHeight, 'F')

        // Valor y unidad en la barra
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(255, 255, 255)
        pdf.setFontSize(7)
        const valorText = `${numVal} ${unidad}`
        pdf.text(valorText, margin + labelWidth + 2, currentY + barHeight - 1.5)

        currentY += barHeight + 2
      })

      currentY += 3 // Espaciado entre grupos
    })

    return currentY
  },

  addPhotosGrid(pdf, startY, pageWidth, tipo, fotos) {
    const margin = 15
    const fotosPerRow = 2
    const photoWidth = (pageWidth - 2 * margin) / fotosPerRow - 5
    const photoHeight = 50

    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(...PDF_COLORS.secondary)

    const label = tipo === 'antes' ? 'ANTES' : tipo === 'despues' ? 'DESPUÉS' : 'FOTOS'
    pdf.text(label, margin, startY + 3)

    let currentY = startY + 8
    let inRow = 0

    for (const foto of fotos) {
      const xPos = margin + (inRow * (photoWidth + 5))

      // Carga la imagen
      try {
        if (foto.dataUrl && foto.dataUrl.startsWith('data:')) {
          pdf.addImage(foto.dataUrl, 'WEBP', xPos, currentY, photoWidth, photoHeight)
        }
      } catch (err) {
        // Placeholder si no se puede cargar
        pdf.setDrawColor(...PDF_COLORS.border)
        pdf.rect(xPos, currentY, photoWidth, photoHeight)
      }

      inRow++
      if (inRow >= fotosPerRow) {
        inRow = 0
        currentY += photoHeight + 3
      }
    }

    // Si última fila no está completa, ajusta currentY
    if (inRow > 0) {
      currentY += photoHeight + 3
    }

    return currentY + 3
  },

  addPhotoWithLabel(pdf, startY, pageWidth, foto) {
    const margin = 15
    const maxPhotoWidth = 80
    const maxPhotoHeight = 60

    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(...PDF_COLORS.secondary)

    const label = foto.tipo === 'antes' ? 'ANTES' : foto.tipo === 'despues' ? 'DESPUÉS' : 'FOTO'
    pdf.text(label, margin, startY + 4)

    // Intentar cargar la imagen desde dataUrl (base64)
    try {
      if (foto.dataUrl && foto.dataUrl.startsWith('data:')) {
        pdf.addImage(foto.dataUrl, 'WEBP', margin, startY + 6, maxPhotoWidth, maxPhotoHeight)
        return startY + maxPhotoHeight + 10
      }
    } catch (err) {
      console.warn('No se pudo cargar foto:', err)
    }

    // Placeholder si no se puede cargar
    pdf.setDrawColor(...PDF_COLORS.border)
    pdf.rect(margin, startY + 6, maxPhotoWidth, maxPhotoHeight)
    pdf.setFontSize(8)
    pdf.setTextColor(...PDF_COLORS.border)
    pdf.text('[Foto no disponible]', margin + 5, startY + 40)

    return startY + maxPhotoHeight + 10
  },

  addObservations(pdf, startY, pageWidth, reporte) {
    const margin = 15
    let y = startY

    // Título (sin emoji)
    pdf.setFillColor(...PDF_COLORS.accent)
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'bold')

    pdf.rect(margin, y, pageWidth - 2 * margin, 7, 'F')
    pdf.text('OBSERVACIONES Y RECOMENDACIONES', margin + 3, y + 4.5)

    y += 10

    pdf.setTextColor(...PDF_COLORS.text)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)

    if (reporte.observaciones) {
      pdf.setFont('helvetica', 'bold')
      pdf.text('Observaciones:', margin, y)
      y += 4

      pdf.setFont('helvetica', 'normal')
      const obsLines = pdf.splitTextToSize(reporte.observaciones, pageWidth - 2 * margin - 4)
      pdf.text(obsLines, margin + 2, y)
      y += obsLines.length * 4 + 3
    }

    if (reporte.recomendaciones) {
      pdf.setFont('helvetica', 'bold')
      pdf.text('Recomendaciones:', margin, y)
      y += 4

      pdf.setFont('helvetica', 'normal')
      const recLines = pdf.splitTextToSize(reporte.recomendaciones, pageWidth - 2 * margin - 4)
      pdf.text(recLines, margin + 2, y)
      y += recLines.length * 4
    }

    return y + 5
  },

  addFooter(pdf, pageWidth, pageHeight) {
    const margin = 15
    const totalPages = pdf.internal.pages.length - 1

    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i)

      // Línea separadora
      pdf.setDrawColor(...PDF_COLORS.border)
      pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12)

      // Número de página
      pdf.setTextColor(...PDF_COLORS.text)
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')
      pdf.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 7, { align: 'center' })

      // Footer text
      pdf.setFontSize(7)
      pdf.setTextColor(150, 150, 150)
      pdf.text('InformeAppSolar - Sistema de Reportes de Inspección', margin, pageHeight - 3)
    }
  },

  formatValue(valor) {
    if (!valor && valor !== 0) return 'Sin dato'
    if (typeof valor === 'string' && valor.endsWith('_foto')) {
      const labels = { antes_foto: 'Foto ANTES', despues_foto: 'Foto DESPUÉS', foto_unica_foto: 'Foto' }
      return labels[valor] || 'Foto'
    }
    if (typeof valor === 'object' && valor !== null && !Array.isArray(valor)) {
      return Object.entries(valor)
        .map(([k, v]) => {
          // Extrae unidad del nombre o usa "V" por defecto (para strings/voltajes)
          let unidad = k.match(/\(([^)]+)\)/)?.[1] || ''
          if (!unidad && (k.includes('inv') || k.includes('string') || k.includes('L'))) {
            unidad = 'V'
          }
          const nombreLimpio = k.replace(/\s*\([^)]*\)/g, '').trim()
          return `${nombreLimpio}: ${v || '-'}${unidad ? ` ${unidad}` : ''}`
        })
        .join('\n')
    }
    return String(valor)
  },
}
