import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { useAuthStore } from '@/stores/authStore'
import MainLayout from '@/components/layout/MainLayout'
import AuthPage from '@/pages/AuthPage'
import DashboardPage from '@/pages/DashboardPage'
import AccountsPage from '@/pages/AccountsPage'
import TransactionsPage from '@/pages/TransactionsPage'
import TransactionDetailPage from '@/pages/TransactionDetailPage'
import ImportPage from '@/pages/ImportPage'
import ImportCenterPage from '@/pages/ChecksPage' // AI Import Center (formerly ChecksPage)
import PaymentsPage from '@/pages/PaymentsPage' // Unified Bills/Checks/Subscriptions
import BusinessPage from '@/pages/BusinessPage'
import ReportsPage from '@/pages/ReportsPage'
import SettingsPage from '@/pages/SettingsPage'
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
                  <Route path="/accounts" element={<AccountsPage />} />
                  <Route path="/transactions" element={<TransactionsPage />} />
                  <Route path="/transactions/:id" element={<TransactionDetailPage />} />
                  <Route path="/import" element={<ImportCenterPage />} />
                  <Route path="/projects" element={<ProjectsPage />} />
                  <Route path="/payments" element={<PaymentsPage />} />
                  <Route path="/business" element={<BusinessPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  
                  {/* Legacy redirects for bookmarks/old links */}
                  <Route path="/entities" element={<Navigate to="/settings" replace />} />
                  <Route path="/checks" element={<Navigate to="/payments" replace />} />
                  <Route path="/bills" element={<Navigate to="/payments" replace />} />
                  <Route path="/cash-flow" element={<Navigate to="/reports" replace />} />
                  <Route path="/alerts" element={<Navigate to="/" replace />} />
                  <Route path="/assistant" element={<Navigate to="/" replace />} />
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

