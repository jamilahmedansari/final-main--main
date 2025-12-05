# Incomplete TODO: Admin Sidebar Role Fetching

## Priority
🔧 **LOW**

## Labels
`technical-debt`, `low-priority`, `todo`, `refactoring`

## Description
The admin sidebar has a TODO comment indicating that the user role should be fetched from auth context rather than being hardcoded, but this has not been implemented.

## Location
- **File**: `components/admin/admin-sidebar.tsx`
- **Line**: 87

## Current Code
```typescript
// TODO: Get user role from auth context
const userRole = 'admin' // Hardcoded
```

## Problem
- Role is hardcoded instead of being dynamic
- If a non-admin accesses this component (shouldn't happen, but...), they'll see admin UI
- Not leveraging actual user authentication data
- Could cause issues if role changes during session

## Expected Behavior
The component should:
1. Fetch the authenticated admin's profile from session
2. Determine actual role (admin vs super_admin)
3. Show/hide UI elements based on real permissions

## Recommended Fix

### Option 1: Fetch from Session Context
```typescript
'use client'
import { useEffect, useState } from 'react'
import { getAdminSession } from '@/lib/auth/admin-session'

export function AdminSidebar() {
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRole() {
      try {
        const session = await getAdminSession()
        if (session?.profile) {
          setUserRole(session.profile.role)
        }
      } catch (error) {
        console.error('Failed to fetch admin role:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchRole()
  }, [])

  if (loading) return <SidebarSkeleton />

  return (
    <div>
      {/* Conditionally show sections based on userRole */}
      {userRole === 'admin' && <AdminOnlySection />}
    </div>
  )
}
```

### Option 2: Server-Side Props (if layout allows)
```typescript
import { getAdminSession } from '@/lib/auth/admin-session'

export default async function AdminLayout() {
  const session = await getAdminSession()

  return (
    <AdminSidebar
      userRole={session?.profile.role}
      userName={session?.profile.email}
    />
  )
}
```

### Option 3: React Context (cleaner for multiple components)
```typescript
// lib/contexts/admin-context.tsx
'use client'

import { createContext, useContext, useState, useEffect } from 'react'

type AdminContextType = {
  role: string | null
  profile: any | null
  loading: boolean
}

const AdminContext = createContext<AdminContextType>({
  role: null,
  profile: null,
  loading: true
})

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AdminContextType>({
    role: null,
    profile: null,
    loading: true
  })

  useEffect(() => {
    async function loadSession() {
      const session = await getAdminSession()
      setState({
        role: session?.profile.role || null,
        profile: session?.profile || null,
        loading: false
      })
    }
    loadSession()
  }, [])

  return (
    <AdminContext.Provider value={state}>
      {children}
    </AdminContext.Provider>
  )
}

export const useAdmin = () => useContext(AdminContext)
```

Then in sidebar:
```typescript
import { useAdmin } from '@/lib/contexts/admin-context'

export function AdminSidebar() {
  const { role, loading } = useAdmin()

  if (loading) return <SidebarSkeleton />

  return (
    <div>
      {role === 'admin' && <AdminOnlySection />}
    </div>
  )
}
```

## Additional Considerations

### Role-Based UI Visibility
Different admin levels might see different features:
```typescript
{role === 'admin' && <AnalyticsLink />}
{role === 'admin' && profile.is_super_user && <SystemSettingsLink />}
```

### Session Expiry Handling
Admin sessions expire after 30 minutes - component should handle this:
```typescript
if (!session) {
  redirect('/secure-admin-gateway/login')
}
```

### Prevent Prop Drilling
If multiple admin components need role info, use Context or Zustand store

## Acceptance Criteria
- [ ] Remove hardcoded role
- [ ] Fetch actual role from admin session
- [ ] Handle loading state
- [ ] Handle session expiry gracefully
- [ ] Show appropriate UI based on real role
- [ ] No console errors
- [ ] Consider React Context if multiple components need role
- [ ] Update other admin components with TODOs
