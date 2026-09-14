'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminAuthStore } from '@/lib/admin-auth-store'

export default function AdminIndexPage() {
  const router = useRouter()
  const isAuthenticated = useAdminAuthStore((s) => s.isAuthenticated)

  useEffect(() => {
    router.replace(isAuthenticated ? '/admin/clube' : '/admin/login')
  }, [isAuthenticated, router])

  return null
}
