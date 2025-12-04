import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Bell, 
  AlertTriangle, 
  CheckCircle2,
  X,
  Wallet,
  TrendingUp,
  Receipt,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useFinancialStore } from '@/stores/financialStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatRelativeDate } from '@/lib/utils'
import type { Alert } from '@/types/database'

const alertIcons = {
  low_balance: Wallet,
  large_transaction: TrendingUp,
  unusual_spending: AlertTriangle,
  bill_due: Receipt,
  bill_overdue: AlertTriangle,
  anomaly: AlertTriangle,
  insight: Sparkles,
}

const severityStyles = {
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-400',
    badge: 'secondary' as const,
  },
  warning: {
    bg: 'bg-warning/10',
    border: 'border-warning/20',
    text: 'text-warning',
    badge: 'warning' as const,
  },
  critical: {
    bg: 'bg-destructive/10',
    border: 'border-destructive/20',
    text: 'text-destructive',
    badge: 'destructive' as const,
  },
}

export default function AlertsWidget() {
  const { alerts, markAlertRead, dismissAlert } = useFinancialStore()
  const [isExpanded, setIsExpanded] = useState(false)

  const unreadAlerts = alerts.filter(a => !a.is_read)
  const displayedAlerts = isExpanded ? alerts.slice(0, 10) : alerts.slice(0, 3)

  const handleMarkAllRead = () => {
    unreadAlerts.forEach(alert => markAlertRead(alert.id))
  }

  const AlertCard = ({ alert }: { alert: Alert }) => {
    const Icon = alertIcons[alert.type] || Bell
    const style = severityStyles[alert.severity]

    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        className={`p-3 rounded-lg border ${style.border} ${style.bg} ${
          !alert.is_read ? 'ring-1 ring-primary/20' : ''
        }`}
      >
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${style.bg} ${style.text}`}>
            <Icon className="w-4 h-4" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-sm">{alert.title}</h3>
                  {!alert.is_read && (
                    <Badge variant="default" className="text-xs h-4">New</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {alert.message}
                </p>
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation()
                  dismissAlert(alert.id)
                }}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
            
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-muted-foreground">
                {formatRelativeDate(alert.created_at)}
              </span>
              <Badge variant={style.badge} className="text-xs h-4">
                {alert.severity}
              </Badge>
              {!alert.is_read && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-xs px-2"
                  onClick={(e) => {
                    e.stopPropagation()
                    markAlertRead(alert.id)
                  }}
                >
                  Mark read
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  if (alerts.length === 0) {
    return null
  }

  return (
    <Card className={unreadAlerts.length > 0 ? 'border-warning/30' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className={`w-5 h-5 ${unreadAlerts.length > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
            <CardTitle className="text-base">Alerts</CardTitle>
            {unreadAlerts.length > 0 && (
              <Badge variant="warning" className="h-5">
                {unreadAlerts.length} new
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            {unreadAlerts.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Mark All Read
              </Button>
            )}
          </div>
        </div>
        <CardDescription>
          {unreadAlerts.length > 0 
            ? `${unreadAlerts.length} alert${unreadAlerts.length !== 1 ? 's' : ''} need your attention`
            : 'All caught up!'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <AnimatePresence mode="popLayout">
          {displayedAlerts.map(alert => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </AnimatePresence>
        
        {alerts.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4 mr-2" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-2" />
                Show {alerts.length - 3} More
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

