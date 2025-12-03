import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { useAuthStore } from '@/stores/authStore'
import MainLayout from '@/components/layout/MainLayout'
import AuthPage from '@/pages/AuthPage'
import DashboardPage from '@/pages/DashboardPage'
import AccountsPage from '@/pages/AccountsPage'
import TransactionsPage from '@/pages/TransactionsPage'
import ChecksPage from '@/pages/ChecksPage'
import BillsPage from '@/pages/BillsPage'
import CashFlowPage from '@/pages/CashFlowPage'
import BusinessPage from '@/pages/BusinessPage'
import AlertsPage from '@/pages/AlertsPage'
import AssistantPage from '@/pages/AssistantPage'
import ReportsPage from '@/pages/ReportsPage'
import SettingsPage from '@/pages/SettingsPage'
import EntitiesPage from '@/pages/EntitiesPage'
import ImportPage from '@/pages/ImportPage'
import ProjectsPage from '@/pages/ProjectsPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, initialize } = useAuthStore()
  
  useEffect(() => {
    initialize()
  }, [initialize])
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />
  }
  
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/entities" element={<EntitiesPage />} />
                  <Route path="/accounts" element={<AccountsPage />} />
                  <Route path="/transactions" element={<TransactionsPage />} />
                  <Route path="/import" element={<ImportPage />} />
                  <Route path="/checks" element={<ChecksPage />} />
                  <Route path="/bills" element={<BillsPage />} />
                  <Route path="/cash-flow" element={<CashFlowPage />} />
                  <Route path="/business" element={<BusinessPage />} />
                  <Route path="/projects" element={<ProjectsPage />} />
                  <Route path="/alerts" element={<AlertsPage />} />
                  <Route path="/assistant" element={<AssistantPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </MainLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}

