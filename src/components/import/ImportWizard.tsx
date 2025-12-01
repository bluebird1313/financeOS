import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  FileSpreadsheet,
  FileText,
  Building2,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Sparkles,
  X,
  Eye,
  HelpCircle,
  Save,
  ArrowRight,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/use-toast'
import { useFinancialStore } from '@/stores/financialStore'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  parseFile,
  previewFile,
  detectFileType,
  cleanMerchantName,
  suggestCategory,
  generateTransactionHash,
  type ParseResult,
  type ParsedTransaction,
  type ColumnMapping,
  type DetectedFormat,
} from '@/lib/importers'
import { suggestColumnMappings, batchCategorizeTransactions } from '@/lib/openai'

interface ImportWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete?: (importedCount: number) => void
}

type WizardStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete'

const FIELD_OPTIONS = [
  { value: 'date', label: 'Date', required: true },
  { value: 'amount', label: 'Amount', required: true },
  { value: 'description', label: 'Description', required: true },
  { value: 'memo', label: 'Memo / Notes' },
  { value: 'debit', label: 'Debit Amount (Withdrawals)' },
  { value: 'credit', label: 'Credit Amount (Deposits)' },
  { value: 'checkNumber', label: 'Check Number' },
  { value: 'balance', label: 'Balance (Skip)' },
  { value: 'referenceId', label: 'Reference ID' },
  { value: 'skip', label: '— Skip this column —' },
]

export default function ImportWizard({ open, onOpenChange, onComplete }: ImportWizardProps) {
  const { user } = useAuthStore()
  const { accounts, businesses, categories, addTransaction, fetchTransactions } = useFinancialStore()
  const { toast } = useToast()

  // Wizard state
  const [step, setStep] = useState<WizardStep>('upload')
  const [isProcessing, setIsProcessing] = useState(false)

  // File state
  const [file, setFile] = useState<File | null>(null)
  const [fileType, setFileType] = useState<string>('')
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [detectedFormat, setDetectedFormat] = useState<DetectedFormat | null>(null)

  // Preview state
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([])
  const [previewRows, setPreviewRows] = useState<string[][]>([])

  // Mapping state
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({})
  const [hasHeaderRow, setHasHeaderRow] = useState(true)
  const [amountIsNegativeForDebits, setAmountIsNegativeForDebits] = useState(true)

  // Import settings
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [selectedEntityId, setSelectedEntityId] = useState<string>('')
  const [saveAsProfile, setSaveAsProfile] = useState(false)
  const [profileName, setProfileName] = useState('')

  // AI categorization
  const [enableAICategorization, setEnableAICategorization] = useState(true)
  const [isCategorizingAI, setIsCategorizingAI] = useState(false)
  const [isAIMapping, setIsAIMapping] = useState(false)

  // Import results
  const [importResults, setImportResults] = useState({
    total: 0,
    imported: 0,
    duplicates: 0,
    errors: 0,
  })

  // Staged transactions for review
  const [stagedTransactions, setStagedTransactions] = useState<Array<{
    transaction: ParsedTransaction
    isDuplicate: boolean
    category: { id: string; name: string } | null
    cleanedMerchant: string
    selected: boolean
  }>>([])
  
  // Pagination for large imports
  const [visibleCount, setVisibleCount] = useState(50)

  // Reset wizard state
  const resetWizard = useCallback(() => {
    setStep('upload')
    setFile(null)
    setFileType('')
    setParseResult(null)
    setDetectedFormat(null)
    setPreviewHeaders([])
    setPreviewRows([])
    setColumnMappings({})
    setHasHeaderRow(true)
    setAmountIsNegativeForDebits(true)
    setSelectedAccountId('')
    setSelectedEntityId('')
    setSaveAsProfile(false)
    setProfileName('')
    setStagedTransactions([])
    setVisibleCount(50)
    setImportResults({ total: 0, imported: 0, duplicates: 0, errors: 0 })
  }, [])

  // Handle file drop/select
  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile)
    setIsProcessing(true)

    try {
      const type = detectFileType(selectedFile.name)
      setFileType(type)

      // Preview the file
      const preview = await previewFile(selectedFile)

      if (preview.error) {
        toast({
          title: 'Error reading file',
          description: preview.error,
          variant: 'destructive',
        })
        setIsProcessing(false)
        return
      }

      // For OFX/QBO files, skip mapping step
      if (type === 'qbo' || type === 'qfx' || type === 'ofx') {
        // Parse directly and go to preview
        const result = await parseFile(selectedFile)
        setParseResult(result)
        
        if (result.success && result.transactions.length > 0) {
          // Stage transactions
          const staged = result.transactions.map(t => ({
            transaction: t,
            isDuplicate: false,
            category: suggestCategory(t.description, t.amount || 0, categories),
            cleanedMerchant: cleanMerchantName(t.description),
            selected: true,
          }))
          setStagedTransactions(staged as any)
          setStep('preview')
        } else {
          toast({
            title: 'No transactions found',
            description: 'The file appears to be empty or in an unsupported format.',
            variant: 'destructive',
          })
        }
      } else {
        // CSV/Excel - need mapping step
        if (preview.headers) {
          setPreviewHeaders(preview.headers)
          setPreviewRows(preview.sampleRows || [])
        }
        if (preview.detectedFormat) {
          setDetectedFormat(preview.detectedFormat)
          
          // Auto-populate mappings from detected format
          const autoMappings: Record<string, string> = {}
          if (preview.detectedFormat.dateColumn) autoMappings[preview.detectedFormat.dateColumn] = 'date'
          if (preview.detectedFormat.amountColumn) autoMappings[preview.detectedFormat.amountColumn] = 'amount'
          if (preview.detectedFormat.descriptionColumn) autoMappings[preview.detectedFormat.descriptionColumn] = 'description'
          if (preview.detectedFormat.memoColumn) autoMappings[preview.detectedFormat.memoColumn] = 'memo'
          if (preview.detectedFormat.debitColumn) autoMappings[preview.detectedFormat.debitColumn] = 'debit'
          if (preview.detectedFormat.creditColumn) autoMappings[preview.detectedFormat.creditColumn] = 'credit'
          if (preview.detectedFormat.checkNumberColumn) autoMappings[preview.detectedFormat.checkNumberColumn] = 'checkNumber'
          if (preview.detectedFormat.balanceColumn) autoMappings[preview.detectedFormat.balanceColumn] = 'skip'
          
          setColumnMappings(autoMappings)
        }
        
        setStep('mapping')
      }
    } catch (error) {
      toast({
        title: 'Error processing file',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }, [categories, toast])

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }, [handleFileSelect])

  // Process mappings and go to preview
  const handleMappingComplete = useCallback(async () => {
    if (!file) return
    
    setIsProcessing(true)
    
    try {
      // Convert column mappings to ColumnMapping format
      const mapping: ColumnMapping = {
        date: null,
        amount: null,
        description: null,
        memo: null,
        debit: null,
        credit: null,
        checkNumber: null,
        balance: null,
        referenceId: null,
      }
      
      for (const [header, field] of Object.entries(columnMappings)) {
        if (field && field !== 'skip') {
          (mapping as any)[field] = header
        }
      }
      
      // Parse file with mappings
      const result = await parseFile(file, mapping, {
        hasHeaderRow,
        amountIsNegativeForDebits,
      })
      
      setParseResult(result)
      
      if (result.success && result.transactions.length > 0) {
        // Stage transactions with category suggestions
        const staged = result.transactions.map(t => ({
          transaction: t,
          isDuplicate: false,
          category: suggestCategory(t.description, t.amount || 0, categories),
          cleanedMerchant: cleanMerchantName(t.description),
          selected: true,
        }))
        setStagedTransactions(staged as any)
        setStep('preview')
      } else {
        toast({
          title: 'No transactions found',
          description: result.errors[0]?.message || 'Could not parse any transactions from the file.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error parsing file',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }, [file, columnMappings, hasHeaderRow, amountIsNegativeForDebits, categories, toast])

  // Toggle transaction selection
  const toggleTransaction = useCallback((index: number) => {
    setStagedTransactions(prev => prev.map((t, i) => 
      i === index ? { ...t, selected: !t.selected } : t
    ))
  }, [])

  // Select/deselect all
  const toggleAll = useCallback((selected: boolean) => {
    setStagedTransactions(prev => prev.map(t => ({ ...t, selected })))
  }, [])

  // Perform the actual import
  const handleImport = useCallback(async () => {
    if (!user || !selectedAccountId) return
    
    const selectedTransactions = stagedTransactions.filter(t => t.selected && !t.isDuplicate)
    
    if (selectedTransactions.length === 0) {
      toast({
        title: 'No transactions to import',
        description: 'Please select at least one transaction to import.',
        variant: 'destructive',
      })
      return
    }
    
    setStep('importing')
    setIsProcessing(true)
    
    let imported = 0
    let errors = 0
    
    for (const staged of selectedTransactions) {
      const t = staged.transaction
      
      try {
        // Create transaction
        const { error } = await supabase.from('transactions').insert({
          user_id: user.id,
          account_id: selectedAccountId,
          amount: t.amount,
          date: t.date,
          name: t.description,
          merchant_name: staged.cleanedMerchant || null,
          category_id: staged.category?.id || null,
          check_number: t.checkNumber || null,
          is_manual: true,
          notes: t.memo || null,
          business_id: selectedEntityId || null,
          plaid_transaction_id: t.referenceId || null, // Use for dedup
        })
        
        if (error) {
          console.error('Error importing transaction:', error)
          errors++
        } else {
          imported++
        }
      } catch (err) {
        console.error('Error importing transaction:', err)
        errors++
      }
    }
    
    // Save profile if requested
    if (saveAsProfile && profileName && file && (fileType === 'csv' || fileType === 'xlsx')) {
      const mapping: ColumnMapping = {
        date: null,
        amount: null,
        description: null,
        memo: null,
        debit: null,
        credit: null,
        checkNumber: null,
        balance: null,
        referenceId: null,
      }
      
      for (const [header, field] of Object.entries(columnMappings)) {
        if (field && field !== 'skip') {
          (mapping as any)[field] = header
        }
      }
      
      await supabase.from('import_profiles').insert({
        user_id: user.id,
        name: profileName,
        file_type: fileType,
        column_mappings: mapping,
        has_header_row: hasHeaderRow,
        amount_is_negative_for_debits: amountIsNegativeForDebits,
        default_account_id: selectedAccountId,
        default_entity_id: selectedEntityId || null,
      })
    }
    
    setImportResults({
      total: stagedTransactions.length,
      imported,
      duplicates: stagedTransactions.filter(t => t.isDuplicate).length,
      errors,
    })
    
    setIsProcessing(false)
    setStep('complete')
    
    // Refresh transactions
    fetchTransactions(user.id)
    
    toast({
      title: 'Import complete!',
      description: `Successfully imported ${imported} transaction${imported !== 1 ? 's' : ''}.`,
    })
    
    if (onComplete) {
      onComplete(imported)
    }
  }, [
    user, selectedAccountId, selectedEntityId, stagedTransactions, 
    saveAsProfile, profileName, file, fileType, columnMappings,
    hasHeaderRow, amountIsNegativeForDebits, fetchTransactions, toast, onComplete
  ])

  // Get file icon
  const getFileIcon = (type: string) => {
    switch (type) {
      case 'csv':
        return <FileText className="w-8 h-8 text-emerald-500" />
      case 'xlsx':
      case 'xls':
        return <FileSpreadsheet className="w-8 h-8 text-green-500" />
      case 'qbo':
      case 'qfx':
      case 'ofx':
        return <Building2 className="w-8 h-8 text-blue-500" />
      default:
        return <FileText className="w-8 h-8" />
    }
  }

  // Confidence badge
  const ConfidenceBadge = ({ confidence }: { confidence: number }) => {
    if (confidence >= 0.8) {
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50">High</Badge>
    } else if (confidence >= 0.5) {
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">Medium</Badge>
    }
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/50">Low</Badge>
  }

  // AI-assisted column mapping
  const handleAIMapping = useCallback(async () => {
    if (previewHeaders.length === 0) return
    
    setIsAIMapping(true)
    
    try {
      const suggestion = await suggestColumnMappings(previewHeaders, previewRows)
      
      if (suggestion.mappings && Object.keys(suggestion.mappings).length > 0) {
        setColumnMappings(suggestion.mappings)
        
        if (suggestion.notes) {
          toast({
            title: 'AI Mapping Complete',
            description: suggestion.notes,
          })
        } else {
          toast({
            title: 'AI Mapping Complete',
            description: `Mapped ${Object.keys(suggestion.mappings).length} columns with ${Math.round(suggestion.confidence * 100)}% confidence.`,
          })
        }
      } else {
        toast({
          title: 'AI Mapping Failed',
          description: 'Could not auto-detect column mappings. Please map manually.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'AI Error',
        description: 'Failed to get AI suggestions. Please map manually.',
        variant: 'destructive',
      })
    } finally {
      setIsAIMapping(false)
    }
  }, [previewHeaders, previewRows, toast])

  // AI categorization for staged transactions
  const handleAICategorization = useCallback(async () => {
    if (stagedTransactions.length === 0) return
    
    setIsCategorizingAI(true)
    
    try {
      const transactionsToCateg = stagedTransactions.map((s, idx) => ({
        index: idx,
        description: s.transaction.description,
        amount: s.transaction.amount || 0,
        date: s.transaction.date || undefined,
      }))
      
      const result = await batchCategorizeTransactions(transactionsToCateg, categories)
      
      if (result.transactions.length > 0) {
        setStagedTransactions(prev => prev.map((s, idx) => {
          const aiResult = result.transactions.find(t => t.index === idx)
          if (aiResult) {
            const matchedCategory = categories.find(c => 
              c.name.toLowerCase() === aiResult.category.toLowerCase()
            )
            return {
              ...s,
              category: matchedCategory ? { id: matchedCategory.id, name: matchedCategory.name } : s.category,
              cleanedMerchant: aiResult.cleanedMerchant || s.cleanedMerchant,
            }
          }
          return s
        }))
        
        toast({
          title: 'AI Categorization Complete',
          description: `Categorized ${result.transactions.length} transactions.`,
        })
      }
    } catch (error) {
      toast({
        title: 'AI Error',
        description: 'Failed to categorize transactions.',
        variant: 'destructive',
      })
    } finally {
      setIsCategorizingAI(false)
    }
  }, [stagedTransactions, categories, toast])

  // Validation for required mappings
  const hasRequiredMappings = useMemo(() => {
    const mappedFields = new Set(Object.values(columnMappings).filter(v => v && v !== 'skip'))
    return mappedFields.has('date') && 
           (mappedFields.has('amount') || (mappedFields.has('debit') || mappedFields.has('credit'))) &&
           mappedFields.has('description')
  }, [columnMappings])

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetWizard()
      onOpenChange(isOpen)
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Import Transactions
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Upload a bank statement file to import transactions'}
            {step === 'mapping' && 'Map your file columns to transaction fields'}
            {step === 'preview' && 'Review transactions before importing'}
            {step === 'importing' && 'Importing transactions...'}
            {step === 'complete' && 'Import complete!'}
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 px-2 py-3 border-b">
          {(['upload', 'mapping', 'preview', 'complete'] as const).map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                ${step === s ? 'bg-primary text-primary-foreground' : 
                  (i < ['upload', 'mapping', 'preview', 'complete'].indexOf(step) 
                    ? 'bg-emerald-500/20 text-emerald-500' 
                    : 'bg-muted text-muted-foreground')}
              `}>
                {i < ['upload', 'mapping', 'preview', 'complete'].indexOf(step) 
                  ? <CheckCircle2 className="w-5 h-5" /> 
                  : i + 1}
              </div>
              {i < 3 && (
                <div className={`w-12 h-0.5 mx-2 ${
                  i < ['upload', 'mapping', 'preview', 'complete'].indexOf(step) 
                    ? 'bg-emerald-500/50' 
                    : 'bg-muted'
                }`} />
              )}
            </div>
          ))}
        </div>

        <ScrollArea className="flex-1 pr-4">
          <AnimatePresence mode="wait">
            {/* STEP 1: Upload */}
            {step === 'upload' && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 p-4"
              >
                {/* Drop Zone */}
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className={`
                    border-2 border-dashed rounded-xl p-12 text-center
                    transition-colors cursor-pointer
                    ${isProcessing ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-primary/5'}
                  `}
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  <input
                    id="file-input"
                    type="file"
                    accept=".csv,.xlsx,.xls,.qbo,.qfx,.ofx"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  />
                  
                  {isProcessing ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-12 h-12 animate-spin text-primary" />
                      <p className="text-lg font-medium">Processing file...</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-lg font-medium mb-2">Drop file here or click to browse</p>
                      <p className="text-sm text-muted-foreground">
                        Supports CSV, Excel (.xlsx, .xls), and bank exports (.qbo, .qfx, .ofx)
                      </p>
                    </>
                  )}
                </div>

                {/* Supported Formats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { type: 'CSV', desc: 'Comma-separated values', icon: FileText, color: 'emerald' },
                    { type: 'Excel', desc: '.xlsx, .xls files', icon: FileSpreadsheet, color: 'green' },
                    { type: 'QBO', desc: 'QuickBooks Online', icon: Building2, color: 'blue' },
                    { type: 'OFX', desc: 'Open Financial Exchange', icon: Building2, color: 'cyan' },
                  ].map(format => (
                    <Card key={format.type} className="border-border/50">
                      <CardContent className="p-4 flex items-center gap-3">
                        <format.icon className={`w-6 h-6 text-${format.color}-500`} />
                        <div>
                          <p className="font-medium text-sm">{format.type}</p>
                          <p className="text-xs text-muted-foreground">{format.desc}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 2: Column Mapping */}
            {step === 'mapping' && (
              <motion.div
                key="mapping"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 p-4"
              >
                {/* File Info */}
                {file && (
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    {getFileIcon(fileType)}
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB • {fileType.toUpperCase()}
                      </p>
                    </div>
                    {detectedFormat && (
                      <div className="ml-auto flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Detection confidence:</span>
                        <ConfidenceBadge confidence={detectedFormat.confidence} />
                      </div>
                    )}
                  </div>
                )}

                {/* Options */}
                <div className="flex flex-wrap gap-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="header-row"
                      checked={hasHeaderRow}
                      onCheckedChange={setHasHeaderRow}
                    />
                    <Label htmlFor="header-row">First row is headers</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="negative-debits"
                      checked={amountIsNegativeForDebits}
                      onCheckedChange={setAmountIsNegativeForDebits}
                    />
                    <Label htmlFor="negative-debits">Debits are negative amounts</Label>
                  </div>
                </div>

                {/* Column Mapping Table */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        Column Mapping
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="w-4 h-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Map each column from your file to a transaction field.</p>
                              <p className="mt-1">Required: Date, Amount (or Debit/Credit), Description</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAIMapping}
                        disabled={isAIMapping}
                        className="flex items-center gap-2"
                      >
                        {isAIMapping ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-primary" />
                            AI Assist
                          </>
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {previewHeaders.map((header, idx) => (
                        <div key={idx} className="grid grid-cols-3 gap-4 items-center">
                          <div className="font-medium text-sm truncate" title={header}>
                            {header || `Column ${idx + 1}`}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            {previewRows[0]?.[idx] || '—'}
                          </div>
                          <Select
                            value={columnMappings[header] || ''}
                            onValueChange={(value) => setColumnMappings(prev => ({
                              ...prev,
                              [header]: value
                            }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select field..." />
                            </SelectTrigger>
                            <SelectContent>
                              {FIELD_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label} {opt.required && '*'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                    
                    {!hasRequiredMappings && (
                      <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-sm">
                        <AlertCircle className="w-4 h-4 text-destructive" />
                        <span>Please map the required fields: Date, Amount (or Debit/Credit), and Description</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Preview Sample */}
                {previewRows.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        Data Preview
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              {previewHeaders.map((h, i) => (
                                <th key={i} className="px-3 py-2 text-left font-medium text-muted-foreground">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {previewRows.slice(0, 3).map((row, i) => (
                              <tr key={i} className="border-b border-border/50">
                                {row.map((cell, j) => (
                                  <td key={j} className="px-3 py-2 truncate max-w-[150px]">
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            )}

            {/* STEP 3: Preview & Configure */}
            {step === 'preview' && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 p-4"
              >
                {/* Import Settings */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Import Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Target Account *</Label>
                        <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select account..." />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map(acc => (
                              <SelectItem key={acc.id} value={acc.id}>
                                {acc.name} ({acc.institution_name || 'Manual'})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Entity (Optional)</Label>
                        <Select value={selectedEntityId || '_personal'} onValueChange={(v) => setSelectedEntityId(v === '_personal' ? '' : v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Personal" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_personal">Personal</SelectItem>
                            {businesses.map(biz => (
                              <SelectItem key={biz.id} value={biz.id}>
                                {biz.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="ai-categorize"
                          checked={enableAICategorization}
                          onCheckedChange={setEnableAICategorization}
                        />
                        <Label htmlFor="ai-categorize" className="flex items-center gap-1">
                          <Sparkles className="w-4 h-4 text-primary" />
                          AI Categorization
                        </Label>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Switch
                          id="save-profile"
                          checked={saveAsProfile}
                          onCheckedChange={setSaveAsProfile}
                        />
                        <Label htmlFor="save-profile">Save as import profile</Label>
                      </div>
                    </div>
                    
                    {saveAsProfile && (
                      <div className="space-y-2">
                        <Label>Profile Name</Label>
                        <Input
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          placeholder="e.g., Chase Personal Checking"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Transaction Preview */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        Transactions ({stagedTransactions.filter(t => t.selected).length} of {stagedTransactions.length} selected)
                      </CardTitle>
                      <div className="flex gap-2">
                        {enableAICategorization && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleAICategorization}
                            disabled={isCategorizingAI}
                          >
                            {isCategorizingAI ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                Categorizing...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4 mr-1 text-primary" />
                                AI Categorize
                              </>
                            )}
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => toggleAll(true)}>
                          Select All
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => toggleAll(false)}>
                          Deselect All
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Summary for large imports */}
                    {stagedTransactions.length > 100 && (
                      <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm">
                        <p className="font-medium text-blue-400">Large Import Detected</p>
                        <p className="text-muted-foreground">
                          Showing {Math.min(visibleCount, stagedTransactions.length)} of {stagedTransactions.length} transactions. 
                          All {stagedTransactions.filter(t => t.selected && !t.isDuplicate).length} selected transactions will be imported.
                        </p>
                      </div>
                    )}
                    
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {stagedTransactions.slice(0, visibleCount).map((staged, idx) => (
                        <div
                          key={idx}
                          className={`
                            flex items-center gap-4 p-3 rounded-lg border
                            ${staged.isDuplicate ? 'bg-yellow-500/5 border-yellow-500/30' : 
                              staged.selected ? 'bg-primary/5 border-primary/30' : 'border-border/50'}
                          `}
                        >
                          <input
                            type="checkbox"
                            checked={staged.selected}
                            onChange={() => toggleTransaction(idx)}
                            disabled={staged.isDuplicate}
                            className="w-4 h-4"
                          />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">
                                {staged.cleanedMerchant || staged.transaction.description}
                              </span>
                              {staged.isDuplicate && (
                                <Badge variant="outline" className="text-yellow-500 border-yellow-500/50">
                                  Duplicate
                                </Badge>
                              )}
                              {staged.category && (
                                <Badge variant="secondary" className="text-xs">
                                  {staged.category.name}
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {staged.transaction.date || 'No date'} • Row {staged.transaction.rowNumber}
                            </div>
                          </div>
                          
                          <div className={`text-right font-semibold ${
                            (staged.transaction.amount || 0) > 0 ? 'text-emerald-500' : ''
                          }`}>
                            {formatCurrency(staged.transaction.amount || 0)}
                          </div>
                        </div>
                      ))}
                      
                      {/* Load More Button */}
                      {visibleCount < stagedTransactions.length && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => setVisibleCount(prev => Math.min(prev + 50, stagedTransactions.length))}
                        >
                          Show More ({stagedTransactions.length - visibleCount} remaining)
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* STEP 4: Importing */}
            {step === 'importing' && (
              <motion.div
                key="importing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-12"
              >
                <Loader2 className="w-16 h-16 animate-spin text-primary mb-4" />
                <p className="text-lg font-medium">Importing transactions...</p>
                <p className="text-sm text-muted-foreground">This may take a moment</p>
              </motion.div>
            )}

            {/* STEP 5: Complete */}
            {step === 'complete' && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-12"
              >
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold mb-2">Import Complete!</h3>
                
                <div className="grid grid-cols-3 gap-6 mt-6 text-center">
                  <div>
                    <div className="text-3xl font-bold text-emerald-500">{importResults.imported}</div>
                    <div className="text-sm text-muted-foreground">Imported</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-yellow-500">{importResults.duplicates}</div>
                    <div className="text-sm text-muted-foreground">Duplicates</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-red-500">{importResults.errors}</div>
                    <div className="text-sm text-muted-foreground">Errors</div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </ScrollArea>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between border-t pt-4 mt-4">
          <Button
            variant="outline"
            onClick={() => {
              if (step === 'upload') {
                onOpenChange(false)
              } else if (step === 'mapping') {
                setStep('upload')
              } else if (step === 'preview') {
                if (fileType === 'qbo' || fileType === 'qfx' || fileType === 'ofx') {
                  setStep('upload')
                } else {
                  setStep('mapping')
                }
              } else if (step === 'complete') {
                onOpenChange(false)
                resetWizard()
              }
            }}
          >
            {step === 'upload' || step === 'complete' ? (
              <>
                <X className="w-4 h-4 mr-2" />
                Close
              </>
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </>
            )}
          </Button>

          {step === 'mapping' && (
            <Button
              onClick={handleMappingComplete}
              disabled={!hasRequiredMappings || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Preview Transactions
                  <ChevronRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          )}

          {step === 'preview' && (
            <Button
              onClick={handleImport}
              disabled={!selectedAccountId || stagedTransactions.filter(t => t.selected && !t.isDuplicate).length === 0}
            >
              <Upload className="w-4 h-4 mr-2" />
              Import {stagedTransactions.filter(t => t.selected && !t.isDuplicate).length} Transactions
            </Button>
          )}

          {step === 'complete' && (
            <Button onClick={() => {
              resetWizard()
              setStep('upload')
            }}>
              <Upload className="w-4 h-4 mr-2" />
              Import More
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
