import { toast } from "sonner"
import { saveAs } from 'file-saver'
import * as XLSX from 'xlsx'

/**
 * Export data to Excel file
 */
export function exportToExcel<T extends Record<string, any>>(
  data: T[],
  filename: string,
  sheetName: string = 'Sheet1'
) {
  try {
    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
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
    const worksheet = XLSX.utils.json_to_sheet(data)
    const csv = XLSX.utils.sheet_to_csv(worksheet)
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    saveAs(blob, `${filename}.csv`)
    toast.success('CSV file downloaded successfully')
  } catch (error) {
    console.error('Export to CSV failed:', error)
    toast.error('Failed to export file')
  }
}

/**
 * Export table to PDF (basic implementation)
 */
export const exportToPDF = () => {
  // Implementation pending
  console.warn('PDF export not implemented');
  toast.info('PDF export feature coming soon');
};

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
