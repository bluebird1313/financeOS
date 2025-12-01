import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import { 
  Plus, 
  FileCheck, 
  Upload, 
  Search, 
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Image,
  Sparkles,
  Link2,
  FileText,
  FileSpreadsheet,
  File,
  Loader2,
  Check as CheckIcon,
  X,
  Edit3,
  ChevronRight,
  RefreshCw,
  Inbox,
  ArrowRight,
  Building2,
  Tag,
  Briefcase,
  HelpCircle,
  Trash2,
  CheckCheck,
} from 'lucide-react'
import { useFinancialStore } from '@/stores/financialStore'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'
import { suggestCheckPayee, processDocumentImport, readFileContent } from '@/lib/openai'
import type { Check, PendingImportItem, DocumentImport } from '@/types/database'

const fileTypeIcons: Record<string, React.ElementType> = {
  csv: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  xls: FileSpreadsheet,
  pdf: FileText,
  ofx: File,
  qfx: File,
  image: Image,
}

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  return fileTypeIcons[ext] || File
}

export default function ChecksPage() {
  const { user } = useAuthStore()
  const { 
    checks, 
    accounts, 
    categories, 
    businesses,
    transactions,
    addCheck, 
    updateCheck,
    addTransaction,
    matchCheckToTransaction,
    getUnmatchedChecks,
    isLoadingChecks,
    fetchAccounts,
  } = useFinancialStore()
  const { toast } = useToast()
  
  // Tab state
  const [activeTab, setActiveTab] = useState('upload')
  
  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showMatchDialog, setShowMatchDialog] = useState(false)
  const [selectedCheck, setSelectedCheck] = useState<Check | null>(null)
  
  // Check form state
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'cleared' | 'void'>('all')
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false)
  const [formData, setFormData] = useState({
    check_number: '',
    payee: '',
    amount: '',
    date_written: new Date().toISOString().split('T')[0],
    memo: '',
    account_id: '',
    category_id: '',
    business_id: '',
  })

  // Document import states
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [processingStatus, setProcessingStatus] = useState('')
  
  // Review queue states
  const [pendingItems, setPendingItems] = useState<PendingImportItem[]>([])
  const [documentImports, setDocumentImports] = useState<DocumentImport[]>([])
  const [isLoadingPending, setIsLoadingPending] = useState(false)
  const [editingItem, setEditingItem] = useState<PendingImportItem | null>(null)
  const [editForm, setEditForm] = useState({
    account_id: '',
    category_id: '',
    business_id: '',
    description: '',
    amount: '',
  })

  const unmatchedChecks = getUnmatchedChecks()

  // Fetch pending items on mount
  useEffect(() => {
    if (user) {
      fetchPendingItems()
      fetchDocumentImports()
    }
  }, [user])

  const fetchPendingItems = async () => {
    if (!user) return
    setIsLoadingPending(true)
    try {
      const { data, error } = await supabase
        .from('pending_import_items')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('date', { ascending: false })
      
      if (error) throw error
      setPendingItems(data || [])
    } catch (error) {
      console.error('Error fetching pending items:', error)
    } finally {
      setIsLoadingPending(false)
    }
  }

  const fetchDocumentImports = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('document_imports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)
      
      if (error) throw error
      setDocumentImports(data || [])
    } catch (error) {
      console.error('Error fetching document imports:', error)
    }
  }

  // Document upload handler
  const onDocumentDrop = useCallback(async (acceptedFiles: File[]) => {
    setUploadedFiles(prev => [...prev, ...acceptedFiles])
  }, [])

  const { getRootProps: getDocRootProps, getInputProps: getDocInputProps, isDragActive: isDocDragActive } = useDropzone({
    onDrop: onDocumentDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/pdf': ['.pdf'],
      'application/x-ofx': ['.ofx'],
      'application/x-qfx': ['.qfx'],
      'text/plain': ['.ofx', '.qfx'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
    },
    multiple: true,
  })

  const processUploadedFiles = async () => {
    if (uploadedFiles.length === 0 || !user) return

    setIsProcessing(true)
    setProcessingProgress(0)
    let totalProcessed = 0
    let totalItems = 0

    try {
      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i]
        setProcessingStatus(`Processing ${file.name}...`)
        setProcessingProgress((i / uploadedFiles.length) * 100)

        // Create document import record
        const docResult = await (supabase as any)
          .from('document_imports')
          .insert({
            user_id: user.id,
            file_name: file.name,
            file_type: file.name.split('.').pop()?.toLowerCase() || 'unknown',
            file_size: file.size,
            status: 'processing',
          })
          .select()
          .single()

        if (docResult.error || !docResult.data) {
          console.error('Error creating document import:', docResult.error)
          continue
        }
        
        const docImport = docResult.data as DocumentImport

        try {
          // Read file content
          const { content, type } = await readFileContent(file)
          
          // Process with AI
          const result = await processDocumentImport(
            content,
            type,
            file.name,
            docImport.id
          )

          if (result.success) {
            totalItems += result.items_created || 0
            totalProcessed++
            toast({
              title: `✅ Processed ${file.name}`,
              description: `Found ${result.items_created || 0} items. ${result.summary}`,
            })
          } else {
            throw new Error(result.error || 'Processing failed')
          }
        } catch (processError: any) {
          console.error('Error processing file:', processError)
          
          // Update document import with error
          await (supabase as any)
            .from('document_imports')
            .update({
              status: 'failed',
              error_message: processError.message,
            })
            .eq('id', docImport.id)

          toast({
            title: `Failed to process ${file.name}`,
            description: processError.message,
            variant: 'destructive',
          })
        }
      }

      setProcessingProgress(100)
      setProcessingStatus('Complete!')
      
      // Refresh pending items
      await fetchPendingItems()
      await fetchDocumentImports()
      
      // Clear uploaded files
      setUploadedFiles([])
      
      // Show summary
      toast({
        title: '🎉 Import Complete!',
        description: `Processed ${totalProcessed} file(s), found ${totalItems} items ready for review.`,
        variant: 'success',
      })

      // Switch to review tab if items found
      if (totalItems > 0) {
        setActiveTab('review')
      }

    } catch (error: any) {
      console.error('Processing error:', error)
      toast({
        title: 'Processing Failed',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
      setProcessingProgress(0)
      setProcessingStatus('')
    }
  }

  const removeUploadedFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  // Approve a pending item
  const approveItem = async (item: PendingImportItem) => {
    if (!user) return

    try {
      // Create transaction or check based on item type
      if (item.item_type === 'check' && item.check_number) {
        const check = await addCheck({
          user_id: user.id,
          account_id: item.suggested_account_id || accounts[0]?.id,
          check_number: item.check_number,
          payee: item.payee || item.description,
          amount: Math.abs(item.amount),
          date_written: item.date,
          memo: item.memo || null,
          category_id: item.suggested_category_id || null,
          business_id: item.suggested_business_id || null,
          status: 'pending',
        })

        if (check) {
          await (supabase as any)
            .from('pending_import_items')
            .update({ 
              status: 'approved',
              imported_check_id: check.id,
              reviewed_at: new Date().toISOString(),
            })
            .eq('id', item.id)
        }
      } else {
        const transaction = await addTransaction({
          user_id: user.id,
          account_id: item.suggested_account_id || accounts[0]?.id,
          amount: item.amount,
          date: item.date,
          name: item.description,
          merchant_name: item.merchant_name || null,
          category_id: item.suggested_category_id || null,
          business_id: item.suggested_business_id || null,
          is_business_expense: item.is_business_expense,
          is_manual: true,
          notes: item.memo || null,
        })

        if (transaction) {
          await (supabase as any)
            .from('pending_import_items')
            .update({ 
              status: 'approved',
              imported_transaction_id: transaction.id,
              reviewed_at: new Date().toISOString(),
            })
            .eq('id', item.id)
        }
      }

      toast({
        title: '✅ Item Approved',
        description: `${item.description} has been imported.`,
      })

      // Refresh lists
      fetchPendingItems()
      if (user) fetchAccounts(user.id)

    } catch (error: any) {
      console.error('Error approving item:', error)
      toast({
        title: 'Failed to approve',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  // Approve all pending items
  const approveAllItems = async () => {
    for (const item of pendingItems) {
      await approveItem(item)
    }
  }

  // Reject a pending item
  const rejectItem = async (item: PendingImportItem) => {
    try {
      await (supabase as any)
        .from('pending_import_items')
        .update({ 
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', item.id)

      toast({
        title: 'Item Rejected',
        description: `${item.description} has been removed.`,
      })

      fetchPendingItems()
    } catch (error: any) {
      console.error('Error rejecting item:', error)
    }
  }

  // Edit pending item
  const startEditItem = (item: PendingImportItem) => {
    setEditingItem(item)
    setEditForm({
      account_id: item.suggested_account_id || '',
      category_id: item.suggested_category_id || '',
      business_id: item.suggested_business_id || '',
      description: item.description,
      amount: item.amount.toString(),
    })
  }

  const saveEditItem = async () => {
    if (!editingItem) return

    try {
      await (supabase as any)
        .from('pending_import_items')
        .update({
          suggested_account_id: editForm.account_id || null,
          suggested_category_id: editForm.category_id || null,
          suggested_business_id: editForm.business_id || null,
          description: editForm.description,
          amount: parseFloat(editForm.amount),
          status: 'modified',
        })
        .eq('id', editingItem.id)

      toast({ title: 'Item Updated' })
      setEditingItem(null)
      fetchPendingItems()
    } catch (error) {
      console.error('Error updating item:', error)
    }
  }

  // Check functions (existing)
  const potentialMatches = selectedCheck ? transactions.filter(t => {
    if (!t.check_number) return false
    const checkNum = t.check_number.replace(/\D/g, '')
    const selectedNum = selectedCheck.check_number.replace(/\D/g, '')
    return checkNum === selectedNum && Math.abs(t.amount) === selectedCheck.amount
  }) : []

  const handleAddCheck = async () => {
    if (!user || !formData.account_id) return
    
    const check = await addCheck({
      user_id: user.id,
      account_id: formData.account_id,
      check_number: formData.check_number,
      payee: formData.payee,
      amount: parseFloat(formData.amount) || 0,
      date_written: formData.date_written,
      memo: formData.memo || null,
      category_id: formData.category_id || null,
      business_id: formData.business_id || null,
      status: 'pending',
    })

    if (check) {
      toast({
        title: 'Check recorded',
        description: `Check #${formData.check_number} to ${formData.payee} has been recorded.`,
        variant: 'success',
      })
      setShowAddDialog(false)
      resetForm()
    }
  }

  const handleMatchCheck = async (transactionId: string) => {
    if (!selectedCheck) return
    
    await matchCheckToTransaction(selectedCheck.id, transactionId)
    toast({
      title: 'Check matched',
      description: 'The check has been matched to the transaction.',
      variant: 'success',
    })
    setShowMatchDialog(false)
    setSelectedCheck(null)
  }

  const handleSuggestPayee = async () => {
    if (!formData.check_number || !formData.amount) {
      toast({
        title: 'Missing information',
        description: 'Please enter check number and amount first.',
        variant: 'destructive',
      })
      return
    }

    setIsGeneratingSuggestion(true)
    try {
      const previousChecks = checks
        .filter(c => c.payee)
        .map(c => ({
          payee: c.payee,
          amount: c.amount,
          checkNumber: c.check_number,
        }))

      const suggestion = await suggestCheckPayee(
        formData.check_number,
        parseFloat(formData.amount),
        previousChecks
      )

      if (suggestion) {
        setFormData(prev => ({ ...prev, payee: suggestion.payee }))
        toast({
          title: 'AI Suggestion',
          description: `Based on your history, this check might be for "${suggestion.payee}" (${Math.round(suggestion.confidence * 100)}% confident)`,
        })
      } else {
        toast({
          title: 'No suggestion available',
          description: 'Not enough data to suggest a payee.',
        })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to generate suggestion.',
        variant: 'destructive',
      })
    } finally {
      setIsGeneratingSuggestion(false)
    }
  }

  const resetForm = () => {
    setFormData({
      check_number: '',
      payee: '',
      amount: '',
      date_written: new Date().toISOString().split('T')[0],
      memo: '',
      account_id: accounts[0]?.id || '',
      category_id: '',
      business_id: '',
    })
  }

  const filteredChecks = checks.filter(check => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (!check.payee.toLowerCase().includes(query) && 
          !check.check_number.includes(query)) {
        return false
      }
    }
    if (statusFilter !== 'all' && check.status !== statusFilter) {
      return false
    }
    return true
  })

  const getStatusIcon = (status: Check['status']) => {
    switch (status) {
      case 'cleared': return <CheckCircle2 className="w-4 h-4 text-success" />
      case 'pending': return <Clock className="w-4 h-4 text-warning" />
      case 'void': return <XCircle className="w-4 h-4 text-destructive" />
    }
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Import Center</h1>
          <p className="text-muted-foreground">Upload documents and manage checks</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Manual Entry
        </Button>
      </div>

      {/* Alert for pending review items */}
      {pendingItems.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <Inbox className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">
                    {pendingItems.length} Item{pendingItems.length !== 1 ? 's' : ''} Pending Review
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    AI has extracted transactions that need your approval before importing.
                  </p>
                </div>
                <Button onClick={() => setActiveTab('review')}>
                  Review Now
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Upload Documents
          </TabsTrigger>
          <TabsTrigger value="review" className="flex items-center gap-2">
            <Inbox className="w-4 h-4" />
            Review Queue
            {pendingItems.length > 0 && (
              <Badge variant="secondary" className="ml-1">{pendingItems.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="checks" className="flex items-center gap-2">
            <FileCheck className="w-4 h-4" />
            Check Register
          </TabsTrigger>
        </TabsList>

        {/* Upload Tab */}
        <TabsContent value="upload" className="space-y-6">
          <motion.div variants={itemVariants}>
            <Card className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  AI-Powered Document Import
                </CardTitle>
                <CardDescription>
                  Upload bank statements, transaction exports, receipts, or check images. 
                  AI will extract and categorize everything automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {/* Dropzone */}
                <div
                  {...getDocRootProps()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    isDocDragActive 
                      ? 'border-primary bg-primary/5 scale-[1.02]' 
                      : 'border-border hover:border-primary/50 hover:bg-accent/50'
                  }`}
                >
                  <input {...getDocInputProps()} />
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Upload className="w-8 h-8 text-primary" />
                    </div>
                    {isDocDragActive ? (
                      <p className="text-lg font-medium text-primary">Drop files here...</p>
                    ) : (
                      <>
                        <div>
                          <p className="text-lg font-medium mb-1">Drag & drop files here</p>
                          <p className="text-sm text-muted-foreground">
                            or click to browse your computer
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-2 mt-2">
                          {[
                            { ext: 'PDF', desc: 'Bank Statements' },
                            { ext: 'CSV', desc: 'Transaction Exports' },
                            { ext: 'Excel', desc: 'Spreadsheets' },
                            { ext: 'OFX/QFX', desc: 'Quicken Files' },
                            { ext: 'Images', desc: 'Check Photos' },
                          ].map(type => (
                            <Badge key={type.ext} variant="outline" className="text-xs">
                              {type.ext}
                            </Badge>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Uploaded Files List */}
                {uploadedFiles.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Files to Process ({uploadedFiles.length})</Label>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setUploadedFiles([])}
                      >
                        Clear All
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      {uploadedFiles.map((file, index) => {
                        const FileIcon = getFileIcon(file.name)
                        return (
                          <div 
                            key={index}
                            className="flex items-center gap-3 p-3 rounded-lg bg-accent/50"
                          >
                            <FileIcon className="w-8 h-8 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{file.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {(file.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeUploadedFile(index)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        )
                      })}
                    </div>

                    {/* Process Button */}
                    <Button 
                      className="w-full mt-4 glow-sm"
                      size="lg"
                      onClick={processUploadedFiles}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {processingStatus || 'Processing...'}
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Process with AI ({uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''})
                        </>
                      )}
                    </Button>

                    {/* Progress Bar */}
                    {isProcessing && (
                      <Progress value={processingProgress} className="mt-2" />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Recent Imports */}
          {documentImports.length > 0 && (
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Imports</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {documentImports.slice(0, 5).map(doc => (
                      <div 
                        key={doc.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-accent/30"
                      >
                        <div className={`w-2 h-2 rounded-full ${
                          doc.status === 'completed' ? 'bg-success' :
                          doc.status === 'needs_review' ? 'bg-warning' :
                          doc.status === 'failed' ? 'bg-destructive' :
                          'bg-muted-foreground'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{doc.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.transactions_found} items found • {formatDate(doc.created_at)}
                          </p>
                        </div>
                        <Badge variant={
                          doc.status === 'completed' ? 'success' :
                          doc.status === 'needs_review' ? 'warning' :
                          doc.status === 'failed' ? 'destructive' : 'secondary'
                        }>
                          {doc.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Supported Formats Info */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Supported File Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {[
                    { icon: FileText, name: 'PDF', desc: 'Bank statements, invoices' },
                    { icon: FileSpreadsheet, name: 'CSV', desc: 'Transaction exports' },
                    { icon: FileSpreadsheet, name: 'Excel', desc: 'Spreadsheets (.xlsx)' },
                    { icon: File, name: 'OFX/QFX', desc: 'Quicken format' },
                    { icon: Image, name: 'Images', desc: 'Check photos, receipts' },
                  ].map(type => (
                    <div key={type.name} className="text-center p-4 rounded-lg bg-accent/30">
                      <type.icon className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="font-medium">{type.name}</p>
                      <p className="text-xs text-muted-foreground">{type.desc}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Review Queue Tab */}
        <TabsContent value="review" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Pending Review</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-warning">
                    {pendingItems.length}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Amount</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(pendingItems.reduce((sum, i) => sum + Math.abs(i.amount), 0))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>High Confidence</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">
                    {pendingItems.filter(i => i.ai_confidence >= 0.7).length}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Needs Attention</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">
                    {pendingItems.filter(i => i.ai_confidence < 0.7).length}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Review Queue */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Items for Review</CardTitle>
                    <CardDescription>
                      Review and approve AI-extracted transactions
                    </CardDescription>
                  </div>
                  {pendingItems.length > 0 && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={fetchPendingItems}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                      </Button>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="sm" onClick={approveAllItems}>
                              <CheckCheck className="w-4 h-4 mr-2" />
                              Approve All
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            Approve all items with their current settings
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingPending ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : pendingItems.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-12 h-12 mx-auto text-success mb-4" />
                    <h3 className="font-semibold mb-2">All caught up!</h3>
                    <p className="text-muted-foreground mb-4">
                      No items pending review. Upload some documents to get started.
                    </p>
                    <Button variant="outline" onClick={() => setActiveTab('upload')}>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Documents
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence>
                      {pendingItems.map((item) => {
                        const account = accounts.find(a => a.id === item.suggested_account_id)
                        const category = categories.find(c => c.id === item.suggested_category_id)
                        const business = businesses.find(b => b.id === item.suggested_business_id)
                        const confidenceColor = item.ai_confidence >= 0.7 ? 'text-success' : 
                                                item.ai_confidence >= 0.4 ? 'text-warning' : 'text-destructive'

                        return (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="border rounded-lg p-4 hover:bg-accent/30 transition-colors"
                          >
                            <div className="flex items-start gap-4">
                              {/* Item Type Icon */}
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                item.item_type === 'check' ? 'bg-blue-500/20' :
                                item.amount < 0 ? 'bg-red-500/20' : 'bg-green-500/20'
                              }`}>
                                {item.item_type === 'check' ? (
                                  <FileCheck className="w-5 h-5 text-blue-500" />
                                ) : item.amount < 0 ? (
                                  <ArrowRight className="w-5 h-5 text-red-500 rotate-45" />
                                ) : (
                                  <ArrowRight className="w-5 h-5 text-green-500 -rotate-45" />
                                )}
                              </div>

                              {/* Main Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold truncate">{item.description}</span>
                                  {item.check_number && (
                                    <Badge variant="outline" className="text-xs">
                                      Check #{item.check_number}
                                    </Badge>
                                  )}
                                </div>
                                
                                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                  <span>{formatDate(item.date)}</span>
                                  {item.merchant_name && (
                                    <>
                                      <span>•</span>
                                      <span>{item.merchant_name}</span>
                                    </>
                                  )}
                                </div>

                                {/* AI Suggestions */}
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {account && (
                                    <Badge variant="secondary" className="text-xs">
                                      <Building2 className="w-3 h-3 mr-1" />
                                      {account.name}
                                    </Badge>
                                  )}
                                  {category && (
                                    <Badge variant="secondary" className="text-xs">
                                      <Tag className="w-3 h-3 mr-1" />
                                      {category.name}
                                    </Badge>
                                  )}
                                  {business && (
                                    <Badge variant="secondary" className="text-xs">
                                      <Briefcase className="w-3 h-3 mr-1" />
                                      {business.name}
                                    </Badge>
                                  )}
                                  {item.is_business_expense && (
                                    <Badge className="text-xs bg-purple-500/20 text-purple-500">
                                      Business Expense
                                    </Badge>
                                  )}
                                </div>

                                {/* AI Notes */}
                                {item.ai_notes && (
                                  <p className="text-xs text-muted-foreground mt-2 italic">
                                    💡 {item.ai_notes}
                                  </p>
                                )}
                                {item.needs_review_reason && (
                                  <p className="text-xs text-warning mt-1">
                                    ⚠️ {item.needs_review_reason}
                                  </p>
                                )}
                              </div>

                              {/* Amount & Actions */}
                              <div className="flex flex-col items-end gap-2">
                                <div className={`text-lg font-bold ${item.amount < 0 ? 'text-destructive' : 'text-success'}`}>
                                  {formatCurrency(item.amount)}
                                </div>
                                
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className={`text-xs ${confidenceColor} flex items-center gap-1`}>
                                        <Sparkles className="w-3 h-3" />
                                        {Math.round(item.ai_confidence * 100)}%
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      AI Confidence Score
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>

                                <div className="flex gap-1 mt-2">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-8 w-8"
                                          onClick={() => startEditItem(item)}
                                        >
                                          <Edit3 className="w-4 h-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Edit</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-8 w-8 text-destructive hover:text-destructive"
                                          onClick={() => rejectItem(item)}
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Reject</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => approveItem(item)}
                                        >
                                          <CheckIcon className="w-4 h-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Approve & Import</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Check Register Tab */}
        <TabsContent value="checks" className="space-y-6">
          {/* Unmatched Checks Alert */}
          {unmatchedChecks.length > 0 && (
            <motion.div variants={itemVariants}>
              <Card className="border-warning/50 bg-warning/5">
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <AlertCircle className="w-8 h-8 text-warning" />
                    <div className="flex-1">
                      <h3 className="font-semibold">
                        {unmatchedChecks.length} Unmatched Check{unmatchedChecks.length !== 1 ? 's' : ''}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        These checks need to be matched with bank transactions.
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => setStatusFilter('pending')}>
                      Review Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Checks</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{checks.length}</div>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Pending</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-warning">
                    {checks.filter(c => c.status === 'pending').length}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Cleared</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">
                    {checks.filter(c => c.status === 'cleared').length}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Pending Amount</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(checks.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Filters */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardContent className="py-4">
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by payee or check number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="cleared">Cleared</SelectItem>
                      <SelectItem value="void">Void</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Check List */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle>Check History</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingChecks ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredChecks.length === 0 ? (
                  <div className="text-center py-12">
                    <FileCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">No checks recorded</h3>
                    <p className="text-muted-foreground mb-4">
                      Record checks manually or import them from documents.
                    </p>
                    <div className="flex gap-2 justify-center">
                      <Button variant="outline" onClick={() => setActiveTab('upload')}>
                        <Upload className="w-4 h-4 mr-2" />
                        Import from File
                      </Button>
                      <Button onClick={() => setShowAddDialog(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Manually
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredChecks.map((check) => {
                      const account = accounts.find(a => a.id === check.account_id)
                      const category = categories.find(c => c.id === check.category_id)
                      const business = businesses.find(b => b.id === check.business_id)
                      
                      return (
                        <div 
                          key={check.id}
                          className="flex items-center justify-between p-4 rounded-lg hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                              <FileCheck className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">#{check.check_number}</span>
                                <span className="text-muted-foreground">to</span>
                                <span className="font-medium">{check.payee}</span>
                                {getStatusIcon(check.status)}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>{formatDate(check.date_written)}</span>
                                {account && (
                                  <>
                                    <span>•</span>
                                    <span>{account.name}</span>
                                  </>
                                )}
                                {category && (
                                  <>
                                    <span>•</span>
                                    <span>{category.name}</span>
                                  </>
                                )}
                                {business && (
                                  <>
                                    <span>•</span>
                                    <Badge variant="secondary" className="text-xs">{business.name}</Badge>
                                  </>
                                )}
                              </div>
                              {check.memo && (
                                <div className="text-sm text-muted-foreground mt-1">
                                  Memo: {check.memo}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="text-lg font-semibold">
                              {formatCurrency(check.amount)}
                            </div>
                            {check.status === 'pending' && !check.matched_transaction_id && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setSelectedCheck(check)
                                  setShowMatchDialog(true)
                                }}
                              >
                                <Link2 className="w-4 h-4 mr-2" />
                                Match
                              </Button>
                            )}
                            <Badge variant={
                              check.status === 'cleared' ? 'success' :
                              check.status === 'pending' ? 'warning' : 'destructive'
                            }>
                              {check.status}
                            </Badge>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Add Check Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record a Check</DialogTitle>
            <DialogDescription>
              Log check details as you write them for easy tracking.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="check_number">Check Number</Label>
                <Input
                  id="check_number"
                  placeholder="e.g., 1234"
                  value={formData.check_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, check_number: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="payee">Payee</Label>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={handleSuggestPayee}
                  disabled={isGeneratingSuggestion}
                >
                  <Sparkles className="w-4 h-4 mr-1" />
                  {isGeneratingSuggestion ? 'Thinking...' : 'AI Suggest'}
                </Button>
              </div>
              <Input
                id="payee"
                placeholder="Who is this check for?"
                value={formData.payee}
                onChange={(e) => setFormData(prev => ({ ...prev, payee: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="date_written">Date Written</Label>
              <Input
                id="date_written"
                type="date"
                value={formData.date_written}
                onChange={(e) => setFormData(prev => ({ ...prev, date_written: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="account">Account</Label>
              <Select
                value={formData.account_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, account_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.filter(a => a.type === 'checking').map(account => (
                    <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="memo">Memo (Optional)</Label>
              <Textarea
                id="memo"
                placeholder="What is this check for?"
                value={formData.memo}
                onChange={(e) => setFormData(prev => ({ ...prev, memo: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category (Optional)</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => (
                      <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {businesses.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="business">Business (Optional)</Label>
                  <Select
                    value={formData.business_id || '_personal'}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, business_id: value === '_personal' ? '' : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Personal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_personal">Personal</SelectItem>
                      {businesses.map(business => (
                        <SelectItem key={business.id} value={business.id}>{business.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleAddCheck} 
              disabled={!formData.check_number || !formData.payee || !formData.amount || !formData.account_id}
            >
              Record Check
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Match Check Dialog */}
      <Dialog open={showMatchDialog} onOpenChange={setShowMatchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Match Check to Transaction</DialogTitle>
            <DialogDescription>
              Select the bank transaction that corresponds to this check.
            </DialogDescription>
          </DialogHeader>
          
          {selectedCheck && (
            <div className="py-4">
              <div className="bg-accent/50 p-4 rounded-lg mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Check #{selectedCheck.check_number}</div>
                    <div className="text-sm text-muted-foreground">To: {selectedCheck.payee}</div>
                  </div>
                  <div className="text-lg font-bold">{formatCurrency(selectedCheck.amount)}</div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Potential Matches</Label>
                {potentialMatches.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No matching transactions found. The check may not have cleared yet.
                  </div>
                ) : (
                  potentialMatches.map(transaction => (
                    <div 
                      key={transaction.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer"
                      onClick={() => handleMatchCheck(transaction.id)}
                    >
                      <div>
                        <div className="font-medium">{transaction.name}</div>
                        <div className="text-sm text-muted-foreground">{formatDate(transaction.date)}</div>
                      </div>
                      <div className="font-semibold">{formatCurrency(Math.abs(transaction.amount))}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMatchDialog(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Pending Item Dialog */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Import Item</DialogTitle>
            <DialogDescription>
              Modify the details before importing.
            </DialogDescription>
          </DialogHeader>
          
          {editingItem && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.amount}
                  onChange={(e) => setEditForm(prev => ({ ...prev, amount: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Account</Label>
                <Select
                  value={editForm.account_id}
                  onValueChange={(value) => setEditForm(prev => ({ ...prev, account_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(account => (
                      <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={editForm.category_id}
                  onValueChange={(value) => setEditForm(prev => ({ ...prev, category_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => (
                      <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {businesses.length > 0 && (
                <div className="space-y-2">
                  <Label>Business</Label>
                  <Select
                    value={editForm.business_id || '_personal'}
                    onValueChange={(value) => setEditForm(prev => ({ ...prev, business_id: value === '_personal' ? '' : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Personal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_personal">Personal</SelectItem>
                      {businesses.map(business => (
                        <SelectItem key={business.id} value={business.id}>{business.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>Cancel</Button>
            <Button onClick={saveEditItem}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
