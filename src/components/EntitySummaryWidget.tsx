import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { 
  User, 
  Building2, 
  Home, 
  TrendingUp,
  Briefcase,
  ChevronRight,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import type { Account, Business, Transaction } from '@/types/database'

interface EntitySummaryWidgetProps {
  accounts: Account[]
  businesses: Business[]
  transactions: Transaction[]
}

interface EntitySummary {
  id: string | null
  name: string
  type: 'personal' | 'business' | 'side_hustle' | 'rental' | 'investment'
  icon: typeof User
  color: string
  assets: number
  liabilities: number
  netWorth: number
  monthlyIncome: number
  monthlyExpenses: number
  accountCount: number
}

const entityIcons = {
  personal: User,
  business: Building2,
  side_hustle: Briefcase,
  rental: Home,
  investment: TrendingUp,
}

const entityColors = {
  personal: '#10b981', // emerald
  business: '#06b6d4', // cyan
  side_hustle: '#8b5cf6', // violet
  rental: '#f59e0b', // amber
  investment: '#ec4899', // pink
}

export default function EntitySummaryWidget({ accounts, businesses, transactions }: EntitySummaryWidgetProps) {
  const navigate = useNavigate()

  const entitySummaries = useMemo(() => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    
    // Calculate Personal entity (accounts without business_id)
    const personalAccounts = accounts.filter(a => !a.business_id)
    const personalTransactions = transactions.filter(t => !t.business_id)
    const personalMonthlyTx = personalTransactions.filter(t => new Date(t.date) >= startOfMonth)
    
    const personalAssets = personalAccounts
      .filter(a => a.type !== 'credit' && a.type !== 'loan')
      .reduce((sum, a) => sum + a.current_balance, 0)
    
    const personalLiabilities = personalAccounts
      .filter(a => a.type === 'credit' || a.type === 'loan')
      .reduce((sum, a) => sum + a.current_balance, 0)

    const summaries: EntitySummary[] = [
      {
        id: null,
        name: 'Personal',
        type: 'personal',
        icon: entityIcons.personal,
        color: entityColors.personal,
        assets: personalAssets,
        liabilities: personalLiabilities,
        netWorth: personalAssets - personalLiabilities,
        monthlyIncome: personalMonthlyTx.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0),
        monthlyExpenses: personalMonthlyTx.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0),
        accountCount: personalAccounts.length,
      }
    ]

    // Calculate each business entity
    businesses.forEach(business => {
      const bizAccounts = accounts.filter(a => a.business_id === business.id)
      const bizTransactions = transactions.filter(t => t.business_id === business.id)
      const bizMonthlyTx = bizTransactions.filter(t => new Date(t.date) >= startOfMonth)
      
      const bizAssets = bizAccounts
        .filter(a => a.type !== 'credit' && a.type !== 'loan')
        .reduce((sum, a) => sum + a.current_balance, 0)
      
      const bizLiabilities = bizAccounts
        .filter(a => a.type === 'credit' || a.type === 'loan')
        .reduce((sum, a) => sum + a.current_balance, 0)

      summaries.push({
        id: business.id,
        name: business.name,
        type: 'business',
        icon: entityIcons.business,
        color: entityColors.business,
        assets: bizAssets,
        liabilities: bizLiabilities,
        netWorth: bizAssets - bizLiabilities,
        monthlyIncome: bizMonthlyTx.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0),
        monthlyExpenses: bizMonthlyTx.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0),
        accountCount: bizAccounts.length,
      })
    })

    return summaries
  }, [accounts, businesses, transactions])

  const totals = useMemo(() => {
    return entitySummaries.reduce(
      (acc, entity) => ({
        assets: acc.assets + entity.assets,
        liabilities: acc.liabilities + entity.liabilities,
        netWorth: acc.netWorth + entity.netWorth,
        monthlyIncome: acc.monthlyIncome + entity.monthlyIncome,
        monthlyExpenses: acc.monthlyExpenses + entity.monthlyExpenses,
      }),
      { assets: 0, liabilities: 0, netWorth: 0, monthlyIncome: 0, monthlyExpenses: 0 }
    )
  }, [entitySummaries])

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Financial Position by Entity</CardTitle>
            <CardDescription>Where your money sits across personal & business</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/overview')}>
            Full Overview
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Header Row */}
        <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border/50 mb-2">
          <div className="col-span-4">Entity</div>
          <div className="col-span-2 text-right">Assets</div>
          <div className="col-span-2 text-right">Liabilities</div>
          <div className="col-span-2 text-right">Net Worth</div>
          <div className="col-span-2 text-right">MTD Net</div>
        </div>

        {/* Entity Rows */}
        <div className="space-y-1">
          {entitySummaries.map((entity, index) => {
            const Icon = entity.icon
            const mtdNet = entity.monthlyIncome - entity.monthlyExpenses
            
            return (
              <motion.div
                key={entity.id || 'personal'}
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                transition={{ delay: index * 0.05 }}
                className="grid grid-cols-12 gap-2 px-3 py-3 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer group"
                onClick={() => entity.id ? navigate(`/business`) : navigate('/accounts')}
              >
                <div className="col-span-4 flex items-center gap-3">
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${entity.color}20` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: entity.color }} />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{entity.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {entity.accountCount} account{entity.accountCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <div className="col-span-2 text-right flex items-center justify-end">
                  <span className="text-sm">{formatCurrency(entity.assets)}</span>
                </div>
                <div className="col-span-2 text-right flex items-center justify-end">
                  <span className="text-sm text-destructive">
                    {entity.liabilities > 0 ? formatCurrency(entity.liabilities) : '—'}
                  </span>
                </div>
                <div className="col-span-2 text-right flex items-center justify-end">
                  <span className={`text-sm font-semibold ${entity.netWorth >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatCurrency(entity.netWorth)}
                  </span>
                </div>
                <div className="col-span-2 text-right flex items-center justify-end">
                  <span className={`text-sm ${mtdNet >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {mtdNet >= 0 ? '+' : ''}{formatCurrency(mtdNet)}
                  </span>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Totals Row */}
        <div className="grid grid-cols-12 gap-2 px-3 py-3 mt-2 border-t border-border bg-muted/30 rounded-lg">
          <div className="col-span-4 flex items-center">
            <span className="font-semibold text-sm">TOTAL</span>
          </div>
          <div className="col-span-2 text-right flex items-center justify-end">
            <span className="font-semibold text-sm">{formatCurrency(totals.assets)}</span>
          </div>
          <div className="col-span-2 text-right flex items-center justify-end">
            <span className="font-semibold text-sm text-destructive">
              {totals.liabilities > 0 ? formatCurrency(totals.liabilities) : '—'}
            </span>
          </div>
          <div className="col-span-2 text-right flex items-center justify-end">
            <span className={`font-bold text-sm ${totals.netWorth >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(totals.netWorth)}
            </span>
          </div>
          <div className="col-span-2 text-right flex items-center justify-end">
            {(() => {
              const totalMtdNet = totals.monthlyIncome - totals.monthlyExpenses
              return (
                <span className={`font-semibold text-sm ${totalMtdNet >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {totalMtdNet >= 0 ? '+' : ''}{formatCurrency(totalMtdNet)}
                </span>
              )
            })()}
          </div>
        </div>

        {/* Quick insight */}
        {entitySummaries.length > 1 && (
          <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Quick insight:</span>{' '}
              {(() => {
                const personal = entitySummaries.find(e => e.id === null)
                const businessTotal = entitySummaries
                  .filter(e => e.id !== null)
                  .reduce((sum, e) => sum + e.netWorth, 0)
                
                if (personal && businessTotal > 0) {
                  const personalPercent = Math.round((personal.netWorth / totals.netWorth) * 100)
                  const businessPercent = 100 - personalPercent
                  return `Your wealth is ${personalPercent}% personal, ${businessPercent}% business.`
                }
                return 'Add a business to see how your wealth is distributed.'
              })()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

