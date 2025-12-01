// Excel Parser (XLSX/XLS)
// Uses SheetJS (xlsx) library for parsing

import * as XLSX from 'xlsx'
import type { ParseResult, ParsedTransaction, ColumnMapping } from './types'
import { parseCSV, detectColumnMappings, parseDate, parseAmount } from './csvParser'

/**
 * Parse Excel file (ArrayBuffer) to ParseResult
 */
export function parseExcel(
  data: ArrayBuffer,
  columnMapping?: ColumnMapping,
  options?: {
    sheetIndex?: number
    hasHeaderRow?: boolean
    skipRows?: number
    amountIsNegativeForDebits?: boolean
  }
): ParseResult {
  try {
    // Read workbook
    const workbook = XLSX.read(data, { type: 'array', cellDates: true })
    
    // Get the specified sheet or first sheet
    const sheetIndex = options?.sheetIndex ?? 0
    const sheetName = workbook.SheetNames[sheetIndex]
    
    if (!sheetName) {
      return {
        success: false,
        transactions: [],
        fileType: 'xlsx',
        errors: [{ message: 'No sheets found in Excel file', severity: 'error' }],
        warnings: [],
      }
    }
    
    const sheet = workbook.Sheets[sheetName]
    
    // Convert to CSV and use CSV parser
    // This gives us consistent behavior across formats
    const csvText = XLSX.utils.sheet_to_csv(sheet, {
      blankrows: false,
      rawNumbers: false,
    })
    
    // Use CSV parser with same options
    const result = parseCSV(csvText, columnMapping, {
      hasHeaderRow: options?.hasHeaderRow ?? true,
      skipRows: options?.skipRows ?? 0,
      amountIsNegativeForDebits: options?.amountIsNegativeForDebits ?? true,
    })
    
    // Update file type
    result.fileType = 'xlsx'
    
    // Add sheet info to warnings
    if (workbook.SheetNames.length > 1) {
      result.warnings.push(`File has ${workbook.SheetNames.length} sheets. Imported from: "${sheetName}"`)
    }
    
    return result
    
  } catch (error) {
    return {
      success: false,
      transactions: [],
      fileType: 'xlsx',
      errors: [{
        message: `Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error',
      }],
      warnings: [],
    }
  }
}

/**
 * Get sheet names from Excel file
 */
export function getExcelSheetNames(data: ArrayBuffer): string[] {
  try {
    const workbook = XLSX.read(data, { type: 'array' })
    return workbook.SheetNames
  } catch {
    return []
  }
}

/**
 * Preview Excel file (get headers and first few rows)
 */
export function previewExcel(
  data: ArrayBuffer,
  options?: {
    sheetIndex?: number
    maxRows?: number
  }
): { headers: string[], rows: string[][], sheetNames: string[] } | null {
  try {
    const workbook = XLSX.read(data, { type: 'array', cellDates: true })
    const sheetIndex = options?.sheetIndex ?? 0
    const maxRows = options?.maxRows ?? 10
    const sheetName = workbook.SheetNames[sheetIndex]
    
    if (!sheetName) return null
    
    const sheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json<string[]>(sheet, { 
      header: 1,
      blankrows: false,
    })
    
    if (jsonData.length === 0) return null
    
    const headers = (jsonData[0] || []).map(h => String(h || ''))
    const rows = jsonData.slice(1, maxRows + 1).map(row => 
      (row || []).map(cell => String(cell ?? ''))
    )
    
    return {
      headers,
      rows,
      sheetNames: workbook.SheetNames,
    }
  } catch {
    return null
  }
}
