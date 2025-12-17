import { isAdminAuthenticated } from '@/lib/auth/admin-session'
import { redirect } from 'next/navigation'

export default async function AdminGatewayPage() {
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) {
    redirect('/secure-admin-gateway/login')
  }

  redirect('/secure-admin-gateway/review')
}