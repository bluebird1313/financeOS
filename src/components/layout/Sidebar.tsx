import { NavLink, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Wallet, 
  ArrowLeftRight, 
  FileCheck, 
  Receipt, 
  TrendingUp, 
  Building2, 
  Bell, 
  MessageSquare, 
  FileBarChart,
  Settings,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useFinancialStore } from '@/stores/financialStore'
import { Badge } from '@/components/ui/badge'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Accounts', href: '/accounts', icon: Wallet },
  { name: 'Transactions', href: '/transactions', icon: ArrowLeftRight },
  { name: 'Import Center', href: '/checks', icon: FileCheck },
  { name: 'Bills & Subs', href: '/bills', icon: Receipt },
  { name: 'Cash Flow', href: '/cash-flow', icon: TrendingUp },
  { name: 'Business', href: '/business', icon: Building2 },
  { name: 'Alerts', href: '/alerts', icon: Bell },
  { name: 'AI Assistant', href: '/assistant', icon: MessageSquare },
  { name: 'Reports', href: '/reports', icon: FileBarChart },
]

export default function Sidebar() {
  const location = useLocation()
  const { alerts, getUnmatchedChecks, getUpcomingBills } = useFinancialStore()
  
  const unreadAlerts = alerts.filter(a => !a.is_read).length
  const unmatchedChecks = getUnmatchedChecks().length
  const upcomingBills = getUpcomingBills().length

  const getBadgeCount = (href: string) => {
    switch (href) {
      case '/alerts':
        return unreadAlerts
      case '/checks':
        return unmatchedChecks
      case '/bills':
        return upcomingBills
      default:
        return 0
    }
  }

  return (
    <div className="w-64 border-r border-border bg-card/50 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-border drag-region">
        <div className="flex items-center gap-3 no-drag">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center glow-sm">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg leading-none">Life Finance</h1>
            <p className="text-xs text-muted-foreground">Operating System</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <nav className="px-3 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href
            const badgeCount = getBadgeCount(item.href)
            
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive 
                    ? "bg-primary/10 text-primary glow-sm" 
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <item.icon className={cn(
                  "w-5 h-5 transition-colors",
                  isActive ? "text-primary" : ""
                )} />
                <span className="flex-1">{item.name}</span>
                {badgeCount > 0 && (
                  <Badge 
                    variant={item.href === '/alerts' ? 'destructive' : 'secondary'}
                    className="h-5 min-w-[20px] flex items-center justify-center"
                  >
                    {badgeCount}
                  </Badge>
                )}
              </NavLink>
            )
          })}
        </nav>
      </ScrollArea>

      {/* Settings at bottom */}
      <div className="p-3 border-t border-border">
        <NavLink
          to="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
            location.pathname === '/settings'
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <Settings className="w-5 h-5" />
          <span>Settings</span>
        </NavLink>
      </div>
    </div>
  )
}


