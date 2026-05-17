import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import html2canvas from 'html2canvas'
import * as XLSX from 'xlsx'

/**
 * Rasterise a DOM node and download it as a PNG.
 * Used for the "Image" export option.
 */
export async function exportNodeAsImage(node, filename = 'export.png') {
  if (!node) return
  const canvas = await html2canvas(node, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
  })
  const url = canvas.toDataURL('image/png')
  triggerDownload(url, filename)
}

/**
 * Rasterise a DOM node and embed it as a single image into a multi-page PDF
 * if it's taller than one A4 page.
 */
export async function exportNodeAsPdf(node, filename = 'export.pdf') {
  if (!node) return
  const canvas = await html2canvas(node, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
  })

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const imgWidth = pageWidth
  const imgHeight = (canvas.height * imgWidth) / canvas.width

  let heightLeft = imgHeight
  let position = 0
  const imgData = canvas.toDataURL('image/png')

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
  heightLeft -= pageHeight

  while (heightLeft > 0) {
    position = heightLeft - imgHeight
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight
  }

  pdf.save(filename)
}

/**
 * Trigger window.print(). The print CSS hides everything except elements
 * carrying the `.print-target` class, so the caller should set that class
 * on the node they want printed (and remove it afterwards if it's normally
 * hidden).
 */
export function printNode(node) {
  if (!node) {
    window.print()
    return
  }
  const HAD_CLASS = node.classList.contains('print-target')
  if (!HAD_CLASS) node.classList.add('print-target')
  // Also remove the offscreen positioning during print so the node lays out
  // properly on paper.
  const HAD_OFFSCREEN = node.classList.contains('print-target-offscreen')
  if (HAD_OFFSCREEN) node.classList.remove('print-target-offscreen')

  const restore = () => {
    if (!HAD_CLASS) node.classList.remove('print-target')
    if (HAD_OFFSCREEN) node.classList.add('print-target-offscreen')
    window.removeEventListener('afterprint', restore)
  }
  window.addEventListener('afterprint', restore)
  window.print()
}

/**
 * Build a workbook with one sheet per (name, rows) entry and trigger download.
 * Use for Reports.
 */
export function exportSheetsAsExcel(sheets, filename = 'export.xlsx') {
  const wb = XLSX.utils.book_new()
  for (const { name, rows } of sheets) {
    const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{}])
    XLSX.utils.book_append_sheet(wb, sheet, name)
  }
  XLSX.writeFile(wb, filename)
}

/**
 * Build a multi-sheet PDF from row data using jspdf-autotable. This produces
 * a vector PDF with proper table headers — better for tabular reports than
 * a screenshot. Used by Reports.
 */
export function exportSheetsAsPdf(sheets, { title, subtitle, filename = 'export.pdf' }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 40
  const headerY = 40
  const bodyTop = 90

  const drawHeader = () => {
    doc.setFontSize(16)
    doc.setTextColor(11, 28, 48)
    doc.text(title || 'PreOp Clinical Suite', marginX, headerY)
    doc.setFontSize(11)
    doc.setTextColor(118, 119, 125)
    if (subtitle) doc.text(subtitle, marginX, headerY + 18)
    const generated = `Generated ${new Date().toLocaleString()}`
    doc.text(generated, pageWidth - marginX - doc.getTextWidth(generated), headerY + 18)
  }

  drawHeader()
  let cursorY = bodyTop

  for (const { name, rows } of sheets) {
    if (!rows.length) continue
    if (cursorY > pageHeight - 120) {
      doc.addPage()
      drawHeader()
      cursorY = bodyTop
    }
    doc.setFontSize(14)
    doc.setTextColor(11, 28, 48)
    doc.text(name, marginX, cursorY)
    const cols = Object.keys(rows[0])
    const body = rows.map((r) => cols.map((c) => (r[c] ?? '').toString()))
    autoTable(doc, {
      head: [cols],
      body,
      startY: cursorY + 10,
      margin: { left: marginX, right: marginX, bottom: 40 },
      styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak' },
      headStyles: { fillColor: [0, 106, 97], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [239, 244, 255] },
    })
    cursorY = (doc.lastAutoTable?.finalY || cursorY + 20) + 30
  }

  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(9)
    doc.setTextColor(118, 119, 125)
    const label = `Page ${i} of ${totalPages}`
    doc.text(label, pageWidth - marginX - doc.getTextWidth(label), pageHeight - 20)
  }

  doc.save(filename)
}

// Internal — kick off a browser download for a data URL.
function triggerDownload(url, filename) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
