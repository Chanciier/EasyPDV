import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { BackupInfo, User, UserRole } from '@easypdv/shared-types'
import { apiRequest } from '@/lib/api-client'
import { useAuthStore } from '@/lib/auth-store'
import { cleanIpcError, isElectron } from './use-hardware'

/** Mesmos papéis que o Main aceita em backup:restore (SEG-05) — o Main confere de novo via /auth/me. */
export const RESTORE_BACKUP_ROLES: UserRole[] = ['administrador', 'gerente', 'proprietario']

export const RESTORE_FORBIDDEN_MESSAGE = 'Restaurar backup é só para gerência — peça a um gerente.'

/** window.easypdv só existe dentro do Electron — hardware/backup são sempre opcionais fora dele. */
function getBridge() {
  if (typeof window === 'undefined') return null
  return window.easypdv ?? null
}

export function useBackupList() {
  return useQuery({
    queryKey: ['backup', 'list'],
    queryFn: () => getBridge()!.listBackups(),
    enabled: isElectron(),
  })
}

export function useCreateBackup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (): Promise<BackupInfo> => getBridge()!.createBackup(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['backup', 'list'] }),
  })
}

/**
 * Restaurar reinicia o backend local (parar → trocar o arquivo → religar) e
 * recarrega a janela — a Promise só resolve depois de tudo isso terminar do
 * lado do Main process (ver apps/electron/src/main/backup-ipc.ts).
 *
 * SEG-05 (2026-10-22): o Main exige o accessToken de quem está logado e
 * confere o papel no backend. Antes, um `GET /auth/me` pelo api-client
 * renova o token se ele já expirou (15 min) — senão o Main recusaria com
 * "sessão expirada" um gerente logado há mais tempo.
 */
export function useRestoreBackup() {
  return useMutation({
    mutationFn: async (fileName: string): Promise<void> => {
      await apiRequest<User>('/auth/me')
      const accessToken = useAuthStore.getState().tokens?.accessToken
      if (!accessToken) throw new Error(RESTORE_FORBIDDEN_MESSAGE)
      try {
        await getBridge()!.restoreBackup(fileName, accessToken)
      } catch (error) {
        throw cleanIpcError(error)
      }
    },
  })
}
