'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Award, LogOut, MessageCircle, ShieldCheck } from 'lucide-react'
import { useAdminAuthStore } from '@/lib/admin-auth-store'

const NAV_ITEMS = [
  { href: '/admin/clube/', label: 'Clube', icon: Award },
  { href: '/admin/whatsapp/', label: 'WhatsApp', icon: MessageCircle },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const user = useAdminAuthStore((s) => s.user)
  const clear = useAdminAuthStore((s) => s.clear)

  const logout = () => {
    clear()
    router.push('/admin/login')
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary-foreground" />
            <span className="font-semibold">Painel Admin</span>
          </div>
          {user && (
            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                    pathname?.startsWith(href.replace(/\/$/, ''))
                      ? 'bg-primary/15 text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="size-4" /> {label}
                </Link>
              ))}
            </nav>
          )}
        </div>
        {user && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              {user.name} · {user.role}
            </span>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 hover:bg-muted"
            >
              <LogOut className="size-4" /> Sair
            </button>
          </div>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
