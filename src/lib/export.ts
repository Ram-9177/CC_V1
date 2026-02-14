import { toast } from "sonner"
import { saveAs } from 'file-saver'

function toPlainText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function escapeCSV(value: unknown): string {
  const text = toPlainText(value)
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

/**
 * Export data to Excel file
 */
export async function exportToExcel<T extends Record<string, any>>(
  data: T[],
  filename: string,
  sheetName: string = 'Sheet1'
) {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      toast.error('No data available to export')
      return
    }

    const rows = flattenForExport(data)
    const headers = Object.keys(rows[0] || {})
    if (headers.length === 0) {
      toast.error('No exportable fields found')
      return
    }

    const { Workbook } = await import('exceljs')
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet(sheetName)

    worksheet.addRow(headers)
    const headerRow = worksheet.getRow(1)
    headerRow.font = { bold: true }

    rows.forEach((row) => {
      worksheet.addRow(headers.map((key) => toPlainText(row[key])))
    })

    headers.forEach((header, index) => {
      const maxCellLength = rows.reduce((max, row) => {
        const length = toPlainText(row[header]).length
        return Math.max(max, length)
      }, header.length)

      worksheet.getColumn(index + 1).width = Math.min(Math.max(maxCellLength + 2, 12), 40)
    })

    const excelBuffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    })
    
    saveAs(blob, `${filename}.xlsx`)
    toast.success('Excel file downloaded successfully')
  } catch (error) {
    console.error('Export to Excel failed:', error)
    toast.error('Failed to export file')
  }
}

/**
 * Export data to CSV file
 */
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  filename: string
) {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      toast.error('No data available to export')
      return
    }

    const rows = flattenForExport(data)
    const headers = Object.keys(rows[0] || {})
    if (headers.length === 0) {
      toast.error('No exportable fields found')
      return
    }

    const csvLines = [
      headers.map(escapeCSV).join(','),
      ...rows.map((row) => headers.map((key) => escapeCSV(row[key])).join(',')),
    ]
    const csv = csvLines.join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    saveAs(blob, `${filename}.csv`)
    toast.success('CSV file downloaded successfully')
  } catch (error) {
    console.error('Export to CSV failed:', error)
    toast.error('Failed to export file')
  }
}

/**
 * Export data to PDF file
 */
export async function exportToPDF<T extends Record<string, any>>(
  data: T[] = [],
  filename: string = 'report'
) {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      toast.error('No data available to export as PDF')
      return
    }

    const flattened = flattenForExport(data)
    const headers = Object.keys(flattened[0] || {})

    if (headers.length === 0) {
      toast.error('No exportable fields found for PDF')
      return
    }

    const [{ jsPDF }, autoTableModule] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ])

    const autoTable = (autoTableModule as any).default || (autoTableModule as any).autoTable
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    const rows = flattened.map((row) =>
      headers.map((key) => {
        const value = row[key]
        if (value === null || value === undefined) return ''
        return typeof value === 'string' ? value : String(value)
      })
    )

    doc.setFontSize(12)
    doc.text(filename, 40, 30)

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 45,
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [255, 155, 81] },
    })

    doc.save(`${filename}.pdf`)
    toast.success('PDF file downloaded successfully')
  } catch (error) {
    console.error('Export to PDF failed:', error)
    toast.error('Failed to export PDF')
  }
}

/**
 * Format data for export by transforming nested objects
 */
export function flattenForExport<T extends Record<string, any>>(
  data: T[]
): Record<string, any>[] {
  return data.map(item => {
    const flattened: Record<string, any> = {}
    
    Object.entries(item).forEach(([key, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Flatten nested objects
        Object.entries(value).forEach(([nestedKey, nestedValue]) => {
          flattened[`${key}_${nestedKey}`] = nestedValue
        })
      } else if (Array.isArray(value)) {
        // Convert arrays to comma-separated strings
        flattened[key] = value.join(', ')
      } else {
        flattened[key] = value
      }
    })
    
    return flattened
  })
}

/**
 * Download file from API endpoint
 */
export async function downloadFile(url: string, filename: string) {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error('Download failed')
    
    const blob = await response.blob()
    saveAs(blob, filename)
    toast.success('File downloaded successfully')
  } catch (error) {
    console.error('Download failed:', error)
    toast.error('Failed to download file')
  }
}
