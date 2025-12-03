// Excel Exporter - Export transactions to Excel with project/account grouping
import * as XLSX from 'xlsx'
import type { Transaction, Account, Project, Business } from '@/types/database'
import { formatCurrency } from '@/lib/utils'

export interface ExportOptions {
  transactions: Transaction[]
  accounts: Account[]
  projects: Project[]
  businesses: Business[]
  filters?: {
    startDate?: string
    endDate?: string
    accountIds?: string[]
    projectIds?: string[]
    businessIds?: string[]
  }
  groupBy?: 'project' | 'account' | 'none'
  includeUnassigned?: boolean
}

export interface ExportResult {
  success: boolean
  fileName: string
  error?: string
}

/**
 * Format a date string to MM/DD/YYYY
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  })
}

/**
 * Export transactions to Excel with separate debit/credit columns
 */
export function exportTransactionsToExcel(options: ExportOptions): ExportResult {
  const {
    transactions,
    accounts,
    projects,
    businesses,
    filters,
    groupBy = 'none',
    includeUnassigned = true,
  } = options

  try {
    // Filter transactions
    let filteredTransactions = [...transactions]
    
    if (filters?.startDate) {
      filteredTransactions = filteredTransactions.filter(t => t.date >= filters.startDate!)
    }
    if (filters?.endDate) {
      filteredTransactions = filteredTransactions.filter(t => t.date <= filters.endDate!)
    }
    if (filters?.accountIds?.length) {
      filteredTransactions = filteredTransactions.filter(t => filters.accountIds!.includes(t.account_id))
    }
    if (filters?.projectIds?.length) {
      filteredTransactions = filteredTransactions.filter(t => 
        t.project_id ? filters.projectIds!.includes(t.project_id) : includeUnassigned
      )
    }
    if (filters?.businessIds?.length) {
      filteredTransactions = filteredTransactions.filter(t => 
        t.business_id ? filters.businessIds!.includes(t.business_id) : includeUnassigned
      )
    }

    // Sort by date
    filteredTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Create workbook
    const workbook = XLSX.utils.book_new()

    // Create detail sheet with all transactions
    const detailData = createDetailSheet(filteredTransactions, accounts, projects, businesses)
    const detailSheet = XLSX.utils.aoa_to_array(detailData)
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(detailData), 'Transactions')

    // Create summary by project
    if (groupBy === 'project' || groupBy === 'none') {
      const projectSummary = createProjectSummary(filteredTransactions, projects)
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(projectSummary), 'By Project')
    }

    // Create summary by account
    if (groupBy === 'account' || groupBy === 'none') {
      const accountSummary = createAccountSummary(filteredTransactions, accounts, businesses)
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(accountSummary), 'By Account')
    }

    // Generate filename with date
    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const fileName = `transactions_export_${dateStr}.xlsx`

    // Write and download
    XLSX.writeFile(workbook, fileName)

    return {
      success: true,
      fileName,
    }
  } catch (error) {
    return {
      success: false,
      fileName: '',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

/**
 * Create the detail sheet with all transactions
 */
function createDetailSheet(
  transactions: Transaction[],
  accounts: Account[],
  projects: Project[],
  businesses: Business[]
): (string | number)[][] {
  const rows: (string | number)[][] = []

  // Header row
  rows.push([
    'Date',
    'Description',
    'Account',
    'Business',
    'Project',
    'Category',
    'Debit',
    'Credit',
    'Check #',
    'Notes',
  ])

  // Data rows
  for (const t of transactions) {
    const account = accounts.find(a => a.id === t.account_id)
    const project = projects.find(p => p.id === t.project_id)
    const business = businesses.find(b => b.id === t.business_id)
    
    const debit = t.amount < 0 ? Math.abs(t.amount) : ''
    const credit = t.amount > 0 ? t.amount : ''

    rows.push([
      formatDate(t.date),
      t.merchant_name || t.name,
      account?.name || 'Unknown',
      business?.name || '',
      project?.name || '',
      '', // Category name would need categories passed in
      debit,
      credit,
      t.check_number || '',
      t.notes || '',
    ])
  }

  // Totals row
  const totalDebit = transactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)
  const totalCredit = transactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0)

  rows.push([]) // Empty row
  rows.push([
    '', '', '', '', '',
    'TOTALS:',
    totalDebit,
    totalCredit,
    '',
    `Net: ${formatCurrency(totalCredit - totalDebit)}`,
  ])

  return rows
}

/**
 * Create project summary sheet
 */
function createProjectSummary(
  transactions: Transaction[],
  projects: Project[]
): (string | number)[][] {
  const rows: (string | number)[][] = []

  // Header
  rows.push(['Project Summary'])
  rows.push([])
  rows.push(['Project', 'Transactions', 'Total Debits', 'Total Credits', 'Net'])

  // Group by project
  const projectGroups = new Map<string | null, Transaction[]>()
  
  for (const t of transactions) {
    const key = t.project_id
    if (!projectGroups.has(key)) {
      projectGroups.set(key, [])
    }
    projectGroups.get(key)!.push(t)
  }

  // Calculate and add rows
  let grandTotalDebit = 0
  let grandTotalCredit = 0

  // Sort projects: active first, then by name
  const sortedKeys = Array.from(projectGroups.keys()).sort((a, b) => {
    if (!a && !b) return 0
    if (!a) return 1 // Unassigned at end
    if (!b) return -1
    const projectA = projects.find(p => p.id === a)
    const projectB = projects.find(p => p.id === b)
    return (projectA?.name || '').localeCompare(projectB?.name || '')
  })

  for (const projectId of sortedKeys) {
    const projectTransactions = projectGroups.get(projectId)!
    const project = projectId ? projects.find(p => p.id === projectId) : null
    
    const debit = projectTransactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)
    const credit = projectTransactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0)
    
    grandTotalDebit += debit
    grandTotalCredit += credit

    rows.push([
      project?.name || '(Unassigned)',
      projectTransactions.length,
      debit,
      credit,
      credit - debit,
    ])
  }

  // Grand total
  rows.push([])
  rows.push([
    'TOTAL',
    transactions.length,
    grandTotalDebit,
    grandTotalCredit,
    grandTotalCredit - grandTotalDebit,
  ])

  return rows
}

/**
 * Create account summary sheet
 */
function createAccountSummary(
  transactions: Transaction[],
  accounts: Account[],
  businesses: Business[]
): (string | number)[][] {
  const rows: (string | number)[][] = []

  // Header
  rows.push(['Account Summary'])
  rows.push([])
  rows.push(['Account', 'Business', 'Transactions', 'Total Debits', 'Total Credits', 'Net'])

  // Group by account
  const accountGroups = new Map<string, Transaction[]>()
  
  for (const t of transactions) {
    if (!accountGroups.has(t.account_id)) {
      accountGroups.set(t.account_id, [])
    }
    accountGroups.get(t.account_id)!.push(t)
  }

  // Calculate and add rows
  let grandTotalDebit = 0
  let grandTotalCredit = 0

  // Sort by account name
  const sortedAccountIds = Array.from(accountGroups.keys()).sort((a, b) => {
    const accountA = accounts.find(acc => acc.id === a)
    const accountB = accounts.find(acc => acc.id === b)
    return (accountA?.name || '').localeCompare(accountB?.name || '')
  })

  for (const accountId of sortedAccountIds) {
    const accountTransactions = accountGroups.get(accountId)!
    const account = accounts.find(a => a.id === accountId)
    const business = account?.business_id ? businesses.find(b => b.id === account.business_id) : null
    
    const debit = accountTransactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)
    const credit = accountTransactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0)
    
    grandTotalDebit += debit
    grandTotalCredit += credit

    rows.push([
      account?.name || 'Unknown',
      business?.name || 'Personal',
      accountTransactions.length,
      debit,
      credit,
      credit - debit,
    ])
  }

  // Grand total
  rows.push([])
  rows.push([
    'TOTAL',
    '',
    transactions.length,
    grandTotalDebit,
    grandTotalCredit,
    grandTotalCredit - grandTotalDebit,
  ])

  return rows
}

/**
 * Export as CSV (simpler format)
 */
export function exportTransactionsToCSV(options: ExportOptions): ExportResult {
  const {
    transactions,
    accounts,
    projects,
    businesses,
    filters,
    includeUnassigned = true,
  } = options

  try {
    // Filter transactions
    let filteredTransactions = [...transactions]
    
    if (filters?.startDate) {
      filteredTransactions = filteredTransactions.filter(t => t.date >= filters.startDate!)
    }
    if (filters?.endDate) {
      filteredTransactions = filteredTransactions.filter(t => t.date <= filters.endDate!)
    }
    if (filters?.accountIds?.length) {
      filteredTransactions = filteredTransactions.filter(t => filters.accountIds!.includes(t.account_id))
    }
    if (filters?.projectIds?.length) {
      filteredTransactions = filteredTransactions.filter(t => 
        t.project_id ? filters.projectIds!.includes(t.project_id) : includeUnassigned
      )
    }

    // Sort by date
    filteredTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Create CSV content
    const rows = createDetailSheet(filteredTransactions, accounts, projects, businesses)
    const csvContent = rows.map(row => 
      row.map(cell => {
        const str = String(cell)
        // Escape quotes and wrap in quotes if contains comma or quote
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }).join(',')
    ).join('\n')

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const fileName = `transactions_export_${dateStr}.csv`
    
    link.setAttribute('href', url)
    link.setAttribute('download', fileName)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    return {
      success: true,
      fileName,
    }
  } catch (error) {
    return {
      success: false,
      fileName: '',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

