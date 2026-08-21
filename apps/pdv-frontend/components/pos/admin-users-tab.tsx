'use client'

import { useState } from 'react'
import { KeyRound, Plus, UserCog } from 'lucide-react'
import type { User, UserRole } from '@easypdv/shared-types'
import { ApiError } from '@/lib/api-client'
import { useCreateUser, useResetUserPassword, useUsers } from '@/hooks/use-users'
import { Modal } from './ui/modal'

const ROLE_LABELS: Record<UserRole, string> = {
  operador: 'Operador',
  supervisor: 'Supervisor',
  gerente: 'Gerente',
  administrador: 'Administrador',
  proprietario: 'Proprietário',
  auditor: 'Auditor',
  tecnico: 'Técnico',
}

const ROLE_OPTIONS = Object.entries(ROLE_LABELS) as [UserRole, string][]

type FormState = { name: string; email: string; password: string; role: UserRole }
const emptyForm: FormState = { name: '', email: '', password: '', role: 'operador' }

function describeError(e: unknown, fallback: string) {
  if (e instanceof ApiError) return e.code
  if (e instanceof Error) return e.message
  return fallback
}

export function AdminUsersTab() {
  const { data: users = [], isLoading } = useUsers()
  const createUser = useCreateUser()
  const resetPassword = useResetUserPassword()

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)

  const [resetTarget, setResetTarget] = useState<User | null>(null)
  const [resetPasswordValue, setResetPasswordValue] = useState('')
  const [resetError, setResetError] = useState<string | null>(null)

  const openNew = () => {
    setForm(emptyForm)
    setFormError(null)
    setOpen(true)
  }

  const openReset = (user: User) => {
    setResetTarget(user)
    setResetPasswordValue('')
    setResetError(null)
  }

  const submitReset = async () => {
    if (!resetTarget) return
    if (resetPasswordValue.length < 8) {
      setResetError('A senha precisa ter pelo menos 8 caracteres.')
      return
    }
    setResetError(null)
    try {
      await resetPassword.mutateAsync({ userId: resetTarget.id, newPassword: resetPasswordValue })
      setResetTarget(null)
    } catch (e) {
      setResetError(describeError(e, 'Erro ao redefinir senha.'))
    }
  }

  const submit = async () => {
    const name = form.name.trim()
    const email = form.email.trim()
    if (!name || !email) {
      setFormError('Informe nome e e-mail.')
      return
    }
    if (form.password.length < 8) {
      setFormError('A senha precisa ter pelo menos 8 caracteres.')
      return
    }
    setFormError(null)
    try {
      await createUser.mutateAsync({ name, email, password: form.password, role: form.role })
      setOpen(false)
    } catch (e) {
      setFormError(describeError(e, 'Erro ao criar usuário.'))
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-end">
        <button
          onClick={openNew}
          className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="size-4" /> Novo usuário
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-[5rem_1fr_1fr_10rem_6rem_3rem] items-center gap-3 border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Matrícula</span>
          <span>Nome</span>
          <span>E-mail</span>
          <span>Papel</span>
          <span>Status</span>
          <span />
        </div>
        <div className="h-full overflow-y-auto pb-4">
          {!isLoading && users.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <UserCog className="size-8 opacity-30" />
              <p className="text-sm">Nenhum usuário cadastrado ainda.</p>
            </div>
          ) : (
            users.map((u) => (
              <div
                key={u.id}
                className="grid grid-cols-[5rem_1fr_1fr_10rem_6rem_3rem] items-center gap-3 border-b border-border/60 px-4 py-2.5 text-sm"
              >
                <span className="font-mono text-muted-foreground">{u.employeeCode}</span>
                <span className="truncate font-medium">{u.name}</span>
                <span className="truncate text-muted-foreground">{u.email}</span>
                <span>{ROLE_LABELS[u.role]}</span>
                <span className={u.active ? 'text-primary' : 'text-muted-foreground'}>
                  {u.active ? 'Ativo' : 'Inativo'}
                </span>
                <button
                  onClick={() => openReset(u)}
                  aria-label={`Redefinir senha de ${u.name}`}
                  title="Redefinir senha"
                  className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <KeyRound className="size-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Novo usuário"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setOpen(false)}
              disabled={createUser.isPending}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={createUser.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createUser.isPending ? 'Criando…' : 'Criar usuário'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Nome</span>
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="pos-input"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">E-mail</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="pos-input"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Senha</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              className="pos-input"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Papel</span>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
              className="pos-input"
            >
              {ROLE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {formError && <p className="text-xs text-destructive">{formError}</p>}
        </div>
      </Modal>

      <Modal
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title={resetTarget ? `Redefinir senha de ${resetTarget.name}` : 'Redefinir senha'}
        size="sm"
        footer={
          <>
            <button
              onClick={() => setResetTarget(null)}
              disabled={resetPassword.isPending}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={submitReset}
              disabled={resetPassword.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resetPassword.isPending ? 'Redefinindo…' : 'Redefinir senha'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            A pessoa vai precisar trocar essa senha assim que entrar de novo.
          </p>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Nova senha</span>
            <input
              autoFocus
              type="password"
              value={resetPasswordValue}
              onChange={(e) => setResetPasswordValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitReset()}
              className="pos-input"
            />
          </label>
          {resetError && <p className="text-xs text-destructive">{resetError}</p>}
        </div>
      </Modal>
    </div>
  )
}
