import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { BackupInfo } from '@easypdv/shared-types'
import { isElectron } from './use-hardware'

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
 */
export function useRestoreBackup() {
  return useMutation({
    mutationFn: (fileName: string): Promise<void> => getBridge()!.restoreBackup(fileName),
  })
}
