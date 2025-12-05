# Missing Employee Dashboard Features

## Priority
🔧 **LOW**

## Labels
`feature-missing`, `low-priority`, `enhancement`, `employee-portal`

## Description
The employee role exists but dashboard features are minimal - only basic commissions view. Missing analytics, detailed coupon performance metrics, and engagement tools that would help employees track and improve their referrals.

## Current State
Employee dashboard likely shows:
- ✅ Basic commissions list
- ❌ Coupon usage analytics
- ❌ Conversion metrics
- ❌ Revenue tracking
- ❌ Performance trends
- ❌ Leaderboard (if multiple employees)

## Missing Features

### 1. Coupon Performance Analytics
**What employees want to see:**
```
┌─────────────────────────────────────────┐
│ My Coupon: JOHN2024                     │
├─────────────────────────────────────────┤
│ Total Uses:           47                │
│ This Month:           12                │
│ Conversion Rate:      34%               │
│ Total Revenue:        $2,340            │
│ Pending Commissions:  $234              │
│ Paid Commissions:     $1,890            │
└─────────────────────────────────────────┘
```

### 2. Conversion Funnel
```typescript
<Card>
  <CardHeader>
    <CardTitle>Conversion Funnel</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-2">
      <div className="flex justify-between">
        <span>Visits with coupon</span>
        <span>150</span>
      </div>
      <ProgressBar value={100} />

      <div className="flex justify-between">
        <span>Started checkout</span>
        <span>75 (50%)</span>
      </div>
      <ProgressBar value={50} />

      <div className="flex justify-between">
        <span>Completed purchase</span>
        <span>47 (31%)</span>
      </div>
      <ProgressBar value={31} />
    </div>
  </CardContent>
</Card>
```

### 3. Referral Timeline
```typescript
<Card>
  <CardHeader>
    <CardTitle>Recent Referrals</CardTitle>
  </CardHeader>
  <CardContent>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Plan</TableHead>
          <TableHead>Commission</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>2024-03-15</TableCell>
          <TableCell>user@example.com</TableCell>
          <TableCell>Premium 8-month</TableCell>
          <TableCell>$50.00</TableCell>
          <TableCell>
            <Badge variant="success">Paid</Badge>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </CardContent>
</Card>
```

### 4. Performance Trends Chart
```typescript
<Card>
  <CardHeader>
    <CardTitle>Referrals Over Time</CardTitle>
  </CardHeader>
  <CardContent>
    <LineChart
      data={monthlyReferrals}
      xAxis="month"
      yAxis="count"
      height={300}
    />
  </CardContent>
</Card>
```

### 5. Shareable Coupon Link
```typescript
<Card>
  <CardHeader>
    <CardTitle>Share Your Coupon</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="flex gap-2">
      <Input
        value={`${APP_URL}/pricing?coupon=JOHN2024`}
        readOnly
      />
      <Button onClick={copyToClipboard}>
        <Copy className="h-4 w-4" />
      </Button>
    </div>

    <div className="flex gap-2 mt-4">
      <Button variant="outline" onClick={shareOnTwitter}>
        <Twitter className="h-4 w-4 mr-2" />
        Share
      </Button>
      <Button variant="outline" onClick={shareOnLinkedIn}>
        <Linkedin className="h-4 w-4 mr-2" />
        Share
      </Button>
    </div>
  </CardContent>
</Card>
```

### 6. Earnings Summary
```typescript
<div className="grid grid-cols-3 gap-4">
  <Card>
    <CardHeader>
      <CardTitle className="text-sm">This Month</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">$234</div>
      <p className="text-xs text-muted-foreground">
        +12% from last month
      </p>
    </CardContent>
  </Card>

  <Card>
    <CardHeader>
      <CardTitle className="text-sm">Total Earned</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">$2,124</div>
      <p className="text-xs text-muted-foreground">
        All time
      </p>
    </CardContent>
  </Card>

  <Card>
    <CardHeader>
      <CardTitle className="text-sm">Pending</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">$50</div>
      <p className="text-xs text-muted-foreground">
        2 commissions
      </p>
    </CardContent>
  </Card>
</div>
```

### 7. Leaderboard (if multiple employees)
```typescript
<Card>
  <CardHeader>
    <CardTitle>Top Performers This Month</CardTitle>
  </CardHeader>
  <CardContent>
    <Table>
      <TableBody>
        <TableRow>
          <TableCell>🥇 Sarah J.</TableCell>
          <TableCell className="text-right">23 referrals</TableCell>
        </TableRow>
        <TableRow className="bg-blue-50">
          <TableCell>🥈 You</TableCell>
          <TableCell className="text-right">12 referrals</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>🥉 Mike T.</TableCell>
          <TableCell className="text-right">9 referrals</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </CardContent>
</Card>
```

## Database Queries Needed

### Analytics Endpoint
**File to create**: `app/api/employee/analytics/route.ts`

```typescript
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Verify employee role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile.role !== 'employee') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get employee's coupon
  const { data: coupon } = await supabase
    .from('coupons')
    .select('*')
    .eq('employee_id', user.id)
    .single()

  // Get usage stats
  const { data: usageStats, count: totalUses } = await supabase
    .from('coupon_usage')
    .select('*, subscriptions(*)', { count: 'exact' })
    .eq('coupon_id', coupon.id)

  // Calculate metrics
  const thisMonth = usageStats.filter(u =>
    new Date(u.used_at) > startOfMonth(new Date())
  ).length

  const totalRevenue = usageStats.reduce((sum, usage) =>
    sum + (usage.subscriptions?.amount || 0), 0
  )

  // Get commissions
  const { data: commissions } = await supabase
    .from('commissions')
    .select('*')
    .eq('employee_id', user.id)

  const pendingCommissions = commissions
    .filter(c => c.status === 'pending')
    .reduce((sum, c) => sum + c.amount, 0)

  const paidCommissions = commissions
    .filter(c => c.status === 'paid')
    .reduce((sum, c) => sum + c.amount, 0)

  return NextResponse.json({
    coupon: coupon.code,
    totalUses,
    thisMonth,
    totalRevenue,
    pendingCommissions,
    paidCommissions,
    recentReferrals: usageStats.slice(0, 10)
  })
}
```

## Implementation Priority

**Phase 1 (Quick Wins):**
- [ ] Earnings summary cards
- [ ] Coupon usage count
- [ ] Recent referrals table

**Phase 2 (Analytics):**
- [ ] Performance trends chart
- [ ] Conversion funnel
- [ ] Monthly comparison

**Phase 3 (Engagement):**
- [ ] Shareable coupon links
- [ ] Social media share buttons
- [ ] Leaderboard

**Phase 4 (Advanced):**
- [ ] Custom date range filtering
- [ ] Export CSV of referrals
- [ ] Email reports

## Acceptance Criteria
- [ ] Employee dashboard shows comprehensive analytics
- [ ] Coupon performance metrics displayed
- [ ] Revenue and commission tracking
- [ ] Recent referrals list with details
- [ ] Shareable coupon link with copy button
- [ ] Performance trends visualization
- [ ] Mobile responsive design
- [ ] Data updates in real-time or near real-time
- [ ] Export functionality for reporting
