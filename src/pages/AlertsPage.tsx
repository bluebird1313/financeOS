import { motion } from 'framer-motion'
import { 
  Bell, 
  AlertTriangle, 
  Info, 
  CheckCircle2,
  X,
  Wallet,
  TrendingUp,
  Receipt,
  Sparkles,
  Settings,
} from 'lucide-react'
import { useFinancialStore } from '@/stores/financialStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatRelativeDate } from '@/lib/utils'
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

export default function AlertsPage() {
  const { alerts, markAlertRead, dismissAlert } = useFinancialStore()

  const unreadAlerts = alerts.filter(a => !a.is_read)
  const readAlerts = alerts.filter(a => a.is_read)

  const handleMarkAllRead = () => {
    unreadAlerts.forEach(alert => markAlertRead(alert.id))
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

  const AlertCard = ({ alert }: { alert: Alert }) => {
    const Icon = alertIcons[alert.type] || Bell
    const style = severityStyles[alert.severity]

    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        className={`p-4 rounded-lg border ${style.border} ${style.bg} ${
          !alert.is_read ? 'ring-1 ring-primary/20' : ''
        }`}
      >
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${style.bg} ${style.text}`}>
            <Icon className="w-5 h-5" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{alert.title}</h3>
                  {!alert.is_read && (
                    <Badge variant="default" className="text-xs">New</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {alert.message}
                </p>
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => dismissAlert(alert.id)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="flex items-center gap-3 mt-3">
              <span className="text-xs text-muted-foreground">
                {formatRelativeDate(alert.created_at)}
              </span>
              <Badge variant={style.badge} className="text-xs">
                {alert.severity}
              </Badge>
              {!alert.is_read && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => markAlertRead(alert.id)}
                >
                  Mark as read
                </Button>
              )}
            </div>
          </div>
        </div>
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
          <h1 className="font-display text-3xl font-bold">Alerts</h1>
          <p className="text-muted-foreground">
            {unreadAlerts.length} unread alert{unreadAlerts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-3">
          {unreadAlerts.length > 0 && (
            <Button variant="outline" onClick={handleMarkAllRead}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Mark All Read
            </Button>
          )}
          <Button variant="outline">
            <Settings className="w-4 h-4 mr-2" />
            Alert Settings
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Alerts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{alerts.length}</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className={unreadAlerts.length > 0 ? 'border-primary/50' : ''}>
            <CardHeader className="pb-2">
              <CardDescription>Unread</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{unreadAlerts.length}</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className={alerts.filter(a => a.severity === 'critical').length > 0 ? 'border-destructive/50' : ''}>
            <CardHeader className="pb-2">
              <CardDescription>Critical</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {alerts.filter(a => a.severity === 'critical').length}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Warnings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                {alerts.filter(a => a.severity === 'warning').length}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Alerts List */}
      {alerts.length === 0 ? (
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No alerts</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  You're all caught up! We'll notify you when something needs your attention.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <>
          {/* Unread Alerts */}
          {unreadAlerts.length > 0 && (
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle>Unread Alerts</CardTitle>
                  <CardDescription>
                    {unreadAlerts.length} alert{unreadAlerts.length !== 1 ? 's' : ''} need your attention
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {unreadAlerts.map(alert => (
                    <AlertCard key={alert.id} alert={alert} />
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Read Alerts */}
          {readAlerts.length > 0 && (
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle>Previous Alerts</CardTitle>
                  <CardDescription>
                    {readAlerts.length} dismissed alert{readAlerts.length !== 1 ? 's' : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {readAlerts.map(alert => (
                    <AlertCard key={alert.id} alert={alert} />
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  )
}


