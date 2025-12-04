import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useFinancialStore } from '@/stores/financialStore'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { TooltipProvider } from '@/components/ui/tooltip'

interface MainLayoutProps {
  children: React.ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { user, initialize } = useAuthStore()
  const { 
    fetchAccounts, 
    fetchTransactions, 
    fetchChecks, 
    fetchBills, 
    fetchBusinesses,
    fetchCategories,
    fetchAlerts,
    fetchRecurringTransactions,
  } = useFinancialStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (user) {
      // Fetch all data when user is authenticated
      fetchAccounts(user.id)
      fetchTransactions(user.id)
      fetchChecks(user.id)
      fetchBills(user.id)
      fetchBusinesses(user.id)
      fetchCategories(user.id)
      fetchAlerts(user.id)
      fetchRecurringTransactions(user.id)
    }
  }, [user, fetchAccounts, fetchTransactions, fetchChecks, fetchBills, fetchBusinesses, fetchCategories, fetchAlerts, fetchRecurringTransactions])

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background overflow-hidden">
        {/* Sidebar */}
        <Sidebar />
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Bar */}
          <TopBar />
          
          {/* Page Content */}
          <main className="flex-1 overflow-auto p-6">
            <div className="max-w-7xl mx-auto animate-fade-in">
              {children}
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}




