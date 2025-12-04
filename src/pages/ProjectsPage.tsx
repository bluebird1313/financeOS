import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Plus, 
  FolderKanban,
  MoreVertical,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  Loader2,
  DollarSign,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  X,
  ExternalLink,
} from 'lucide-react'
import { useFinancialStore } from '@/stores/financialStore'
import { useAuthStore } from '@/stores/authStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'
import type { Project } from '@/types/database'

const PROJECT_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#eab308', // Yellow
  '#84cc16', // Lime
  '#22c55e', // Green
  '#10b981', // Emerald
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#0ea5e9', // Sky
  '#3b82f6', // Blue
]

export default function ProjectsPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { 
    projects, 
    transactions,
    isLoadingProjects,
    fetchProjects, 
    addProject, 
    updateProject, 
    deleteProject 
  } = useFinancialStore()
  const { toast } = useToast()
  
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [viewingProjectTransactions, setViewingProjectTransactions] = useState<Project | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active')
  const [formData, setFormData] = useState({
    name: '',
    color: '#6366f1',
  })

  // Get transactions for the project being viewed
  const projectTransactions = useMemo(() => {
    if (!viewingProjectTransactions) return []
    return transactions.filter(t => t.project_id === viewingProjectTransactions.id).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }, [transactions, viewingProjectTransactions])

  // Calculate stats for the project being viewed  
  const viewingProjectStats = useMemo(() => {
    const income = projectTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)
    const expenses = projectTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0)
    return { income, expenses, net: income - expenses, count: projectTransactions.length }
  }, [projectTransactions])

  useEffect(() => {
    if (user) {
      fetchProjects(user.id)
    }
  }, [user, fetchProjects])

  const activeProjects = projects.filter(p => p.is_active)
  const archivedProjects = projects.filter(p => !p.is_active)

  const getProjectStats = (projectId: string) => {
    const projectTransactions = transactions.filter(t => t.project_id === projectId)
    const income = projectTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)
    const expenses = projectTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0)
    return {
      transactionCount: projectTransactions.length,
      income,
      expenses,
      net: income - expenses,
    }
  }

  const handleAddProject = async () => {
    if (!user || !formData.name.trim()) return
    
    setIsSaving(true)
    try {
      const project = await addProject({
        user_id: user.id,
        name: formData.name.trim(),
        color: formData.color,
        is_active: true,
      })

      if (project) {
        toast({
          title: 'Project created',
          description: `${formData.name} has been created successfully.`,
        })
        setShowAddDialog(false)
        resetForm()
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create project. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateProject = async () => {
    if (!editingProject || !formData.name.trim()) return
    
    setIsSaving(true)
    try {
      await updateProject(editingProject.id, {
        name: formData.name.trim(),
        color: formData.color,
      })
      toast({
        title: 'Project updated',
        description: `${formData.name} has been updated.`,
      })
      setEditingProject(null)
      resetForm()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update project. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleArchive = async (project: Project) => {
    await updateProject(project.id, { is_active: !project.is_active })
    toast({
      title: project.is_active ? 'Project archived' : 'Project restored',
      description: `${project.name} has been ${project.is_active ? 'archived' : 'restored'}.`,
    })
  }

  const handleDeleteProject = async () => {
    if (!projectToDelete) return
    
    setIsDeleting(true)
    try {
      const success = await deleteProject(projectToDelete.id)
      if (success) {
        toast({
          title: 'Project deleted',
          description: `${projectToDelete.name} has been deleted.`,
        })
        setProjectToDelete(null)
      } else {
        toast({
          title: 'Error',
          description: 'Failed to delete project. Please try again.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete project. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      color: '#6366f1',
    })
  }

  const openEditDialog = (project: Project) => {
    setFormData({
      name: project.name,
      color: project.color,
    })
    setEditingProject(project)
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  const renderProjectCard = (project: Project) => {
    const stats = getProjectStats(project.id)
    
    return (
      <motion.div key={project.id} variants={itemVariants}>
        <Card 
          className="hover:border-primary/30 transition-colors cursor-pointer"
          onClick={() => setViewingProjectTransactions(project)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${project.color}20` }}
                >
                  <FolderKanban 
                    className="w-5 h-5" 
                    style={{ color: project.color }}
                  />
                </div>
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    {project.name}
                    {!project.is_active && (
                      <Badge variant="secondary" className="text-xs">Archived</Badge>
                    )}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {stats.transactionCount} transaction{stats.transactionCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEditDialog(project)}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleToggleArchive(project)}>
                    {project.is_active ? (
                      <>
                        <Archive className="w-4 h-4 mr-2" />
                        Archive
                      </>
                    ) : (
                      <>
                        <ArchiveRestore className="w-4 h-4 mr-2" />
                        Restore
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="text-destructive"
                    onSelect={(e) => {
                      e.preventDefault()
                      setProjectToDelete(project)
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {stats.transactionCount > 0 && (
              <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Income</div>
                  <div className="font-medium text-emerald-500">
                    {formatCurrency(stats.income)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Expenses</div>
                  <div className="font-medium text-red-500">
                    {formatCurrency(stats.expenses)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Net</div>
                  <div className={`font-medium ${stats.net >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {formatCurrency(stats.net)}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    )
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
          <h1 className="font-display text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground">Organize transactions by project</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <FolderKanban className="w-4 h-4" />
                Active Projects
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeProjects.length}</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                Tagged Transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {transactions.filter(t => t.project_id).length}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Total Project Spend
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(
                  transactions
                    .filter(t => t.project_id && t.amount < 0)
                    .reduce((sum, t) => sum + Math.abs(t.amount), 0)
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {isLoadingProjects ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : projects.length === 0 ? (
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <FolderKanban className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No projects yet</h3>
                <p className="text-muted-foreground mb-4 max-w-sm mx-auto">
                  Create projects to organize and track transactions for specific clients, jobs, or initiatives.
                </p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Project
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div variants={itemVariants}>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'active' | 'archived')}>
            <TabsList>
              <TabsTrigger value="active">
                Active ({activeProjects.length})
              </TabsTrigger>
              <TabsTrigger value="archived">
                Archived ({archivedProjects.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-4">
              {activeProjects.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No active projects. Create one to get started!
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeProjects.map(renderProjectCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="archived" className="mt-4">
              {archivedProjects.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No archived projects.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {archivedProjects.map(renderProjectCard)}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>
      )}

      {/* Add/Edit Project Dialog */}
      <Dialog 
        open={showAddDialog || !!editingProject} 
        onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false)
            setEditingProject(null)
            resetForm()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProject ? 'Edit Project' : 'Create New Project'}
            </DialogTitle>
            <DialogDescription>
              {editingProject 
                ? 'Update your project details.'
                : 'Create a project to organize transactions.'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                placeholder="e.g., Client ABC Website"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {PROJECT_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-lg transition-all ${
                      formData.color === color 
                        ? 'ring-2 ring-offset-2 ring-offset-background ring-primary scale-110' 
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                  />
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAddDialog(false)
                setEditingProject(null)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={editingProject ? handleUpdateProject : handleAddProject} 
              disabled={!formData.name.trim() || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {editingProject ? 'Saving...' : 'Creating...'}
                </>
              ) : (
                editingProject ? 'Save Changes' : 'Create Project'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{projectToDelete?.name}"? 
              This will remove the project but transactions will keep their data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setProjectToDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              disabled={isDeleting}
              onClick={handleDeleteProject}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Project'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Transactions Dialog */}
      <Dialog 
        open={!!viewingProjectTransactions} 
        onOpenChange={(open) => !open && setViewingProjectTransactions(null)}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {viewingProjectTransactions && (
                <>
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${viewingProjectTransactions.color}20` }}
                  >
                    <FolderKanban 
                      className="w-5 h-5" 
                      style={{ color: viewingProjectTransactions.color }}
                    />
                  </div>
                  {viewingProjectTransactions.name} Transactions
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {viewingProjectStats.count} transaction{viewingProjectStats.count !== 1 ? 's' : ''} found
            </DialogDescription>
          </DialogHeader>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 py-4 border-b">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Income</p>
              <p className="text-xl font-bold text-emerald-500">+{formatCurrency(viewingProjectStats.income)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Expenses</p>
              <p className="text-xl font-bold text-red-500">-{formatCurrency(viewingProjectStats.expenses)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Net</p>
              <p className={`text-xl font-bold ${viewingProjectStats.net >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {viewingProjectStats.net >= 0 ? '+' : ''}{formatCurrency(viewingProjectStats.net)}
              </p>
            </div>
          </div>

          {/* Transactions List */}
          <ScrollArea className="flex-1 -mx-6 px-6">
            {projectTransactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No transactions for this project</p>
              </div>
            ) : (
              <div className="space-y-2 py-4">
                {projectTransactions.map((txn) => (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer group"
                    onClick={() => {
                      setViewingProjectTransactions(null)
                      navigate(`/transactions/${txn.id}`)
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                        txn.amount > 0 
                          ? 'bg-emerald-500/10 text-emerald-500' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {txn.amount > 0 
                          ? <ArrowDownRight className="w-4 h-4" />
                          : <ArrowUpRight className="w-4 h-4" />
                        }
                      </div>
                      <div>
                        <p className="font-medium">{txn.merchant_name || txn.name}</p>
                        <p className="text-sm text-muted-foreground">{formatDate(txn.date)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-semibold ${txn.amount > 0 ? 'text-emerald-500' : ''}`}>
                        {txn.amount > 0 ? '+' : ''}{formatCurrency(txn.amount)}
                      </span>
                      <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setViewingProjectTransactions(null)}>
              <X className="w-4 h-4 mr-2" />
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

