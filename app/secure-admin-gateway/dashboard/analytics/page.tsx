'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Users,
  FileText,
  DollarSign,
  Clock,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  CreditCard
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'

interface AnalyticsData {
  dashboard: {
    total_users: number
    total_subscribers: number
    total_employees: number
    pending_letters: number
    approved_letters_today: number
    total_revenue: number
    pending_commissions: number
  }
  letters: {
    total_letters: number
    pending_count: number
    approved_count: number
    rejected_count: number
    failed_count: number
    avg_review_time_hours: number
  }
  subscriptions: {
    active_subscriptions: number
    monthly_subscriptions: number
    yearly_subscriptions: number
    one_time_purchases: number
    total_credits_remaining: number
    avg_credits_per_user: number
  }
  revenue: Array<{
    month_year: string
    subscription_revenue: number
    commission_paid: number
    net_revenue: number
    new_subscriptions: number
  }>
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [daysBack, setDaysBack] = useState('30')
  const [refreshing, setRefreshing] = useState(false)

  const fetchAnalytics = async () => {
    try {
      setRefreshing(true)
      const response = await fetch(`/api/admin/analytics?days=${daysBack}&months=12`)
      if (!response.ok) {
        throw new Error('Failed to fetch analytics')
      }
      const result = await response.json()
      setData(result.data)
      setError(null)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load analytics'
      setError(errorMessage)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [daysBack])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Failed to Load Analytics</h2>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={fetchAnalytics}>Try Again</Button>
      </div>
    )
  }

  if (!data) return null

  const letterStatusData = [
    { name: 'Pending', value: data.letters.pending_count, color: '#f59e0b' },
    { name: 'Approved', value: data.letters.approved_count, color: '#10b981' },
    { name: 'Rejected', value: data.letters.rejected_count, color: '#ef4444' },
    { name: 'Failed', value: data.letters.failed_count, color: '#6b7280' }
  ].filter(item => item.value > 0)

  const subscriptionData = [
    { name: 'Monthly', value: data.subscriptions.monthly_subscriptions, color: '#3b82f6' },
    { name: 'Yearly', value: data.subscriptions.yearly_subscriptions, color: '#10b981' },
    { name: 'One-Time', value: data.subscriptions.one_time_purchases, color: '#8b5cf6' }
  ].filter(item => item.value > 0)

  const revenueChartData = [...data.revenue].reverse().map(item => ({
    month: item.month_year,
    revenue: Number(item.subscription_revenue) || 0,
    commission: Number(item.commission_paid) || 0,
    net: Number(item.net_revenue) || 0
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive overview of system performance and metrics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={daysBack} onValueChange={setDaysBack}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={fetchAnalytics}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.dashboard.total_users}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">
                {data.dashboard.total_subscribers} subscribers
              </Badge>
              <Badge variant="outline" className="text-xs">
                {data.dashboard.total_employees} employees
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Letters (Period)</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.letters.total_letters}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="default" className="text-xs bg-yellow-500">
                {data.dashboard.pending_letters} pending
              </Badge>
              <Badge variant="default" className="text-xs bg-green-500">
                {data.dashboard.approved_letters_today} today
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${Number(data.dashboard.total_revenue).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ${Number(data.dashboard.pending_commissions).toFixed(2)} pending commissions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Review Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Number(data.letters.avg_review_time_hours).toFixed(1)}h
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Average time to approval
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Letter Status Distribution
            </CardTitle>
            <CardDescription>
              Breakdown of letters by current status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {letterStatusData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={letterStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {letterStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No letter data available
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">{data.letters.approved_count} Approved</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span className="text-sm">{data.letters.pending_count} Pending</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm">{data.letters.rejected_count} Rejected</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-gray-500" />
                <span className="text-sm">{data.letters.failed_count} Failed</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Subscription Breakdown
            </CardTitle>
            <CardDescription>
              Active subscriptions by plan type
            </CardDescription>
          </CardHeader>
          <CardContent>
            {subscriptionData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={subscriptionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {subscriptionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No subscription data available
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <p className="text-sm text-muted-foreground">Active Subscriptions</p>
                <p className="text-xl font-bold">{data.subscriptions.active_subscriptions}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Credits Available</p>
                <p className="text-xl font-bold">{data.subscriptions.total_credits_remaining}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Credits/User</p>
                <p className="text-xl font-bold">
                  {Number(data.subscriptions.avg_credits_per_user).toFixed(1)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Revenue Trends
          </CardTitle>
          <CardDescription>
            Monthly revenue breakdown over the past 12 months
          </CardDescription>
        </CardHeader>
        <CardContent>
          {revenueChartData.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      const [year, month] = value.split('-')
                      return new Date(Number(year), Number(month) - 1).toLocaleDateString('en-US', { month: 'short' })
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
                    labelFormatter={(label) => {
                      const [year, month] = label.split('-')
                      return new Date(Number(year), Number(month) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                    }}
                  />
                  <Legend />
                  <Bar dataKey="revenue" name="Gross Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="commission" name="Commissions Paid" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="net" name="Net Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-80 flex items-center justify-center text-muted-foreground">
              No revenue data available
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Approval Rate</span>
              <span className="font-semibold">
                {data.letters.total_letters > 0
                  ? ((data.letters.approved_count / data.letters.total_letters) * 100).toFixed(1)
                  : 0}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Rejection Rate</span>
              <span className="font-semibold">
                {data.letters.total_letters > 0
                  ? ((data.letters.rejected_count / data.letters.total_letters) * 100).toFixed(1)
                  : 0}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Avg Review Time</span>
              <span className="font-semibold">{Number(data.letters.avg_review_time_hours).toFixed(1)} hours</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">User Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Users</span>
              <span className="font-semibold">{data.dashboard.total_users}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Subscribers</span>
              <span className="font-semibold">{data.dashboard.total_subscribers}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Employees</span>
              <span className="font-semibold">{data.dashboard.total_employees}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Commission Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Paid</span>
              <span className="font-semibold text-green-600">
                ${data.revenue.reduce((sum, r) => sum + Number(r.commission_paid || 0), 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Pending</span>
              <span className="font-semibold text-yellow-600">
                ${Number(data.dashboard.pending_commissions).toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
