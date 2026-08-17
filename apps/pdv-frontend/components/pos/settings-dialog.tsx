'use client'

import { useEffect, useState } from 'react'
import { Printer, Wifi, WifiOff, DatabaseBackup, RotateCcw } from 'lucide-react'
import { Modal } from './ui/modal'
import {
  isElectron,
  useHardwareSettings,
  useOpenDrawer,
  usePrinterList,
  usePrintReceipt,
  useUpdateHardwareSettings,
} from '@/hooks/use-hardware'
import { useBackupList, useCreateBackup, useRestoreBackup } from '@/hooks/use-backup'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const electron = isElectron()
  const { data: settings } = useHardwareSettings()
  const { data: printers = [], isLoading: loadingPrinters } = usePrinterList()
  const updateSettings = useUpdateHardwareSettings()
  const printReceipt = usePrintReceipt()
  const openDrawer = useOpenDrawer()
  const { data: backups = [], isLoading: loadingBackups } = useBackupList()
  const createBackup = useCreateBackup()
  const restoreBackup = useRestoreBackup()

  const [printerName, setPrinterName] = useState('')
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(true)
  const [autoOpenDrawerOnCash, setAutoOpenDrawerOnCash] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [backupMessage, setBackupMessage] = useState<string | null>(null)
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null)

  useEffect(() => {
    if (!settings) return
    setPrinterName(settings.printerName ?? '')
    setAutoPrintReceipt(settings.autoPrintReceipt)
    setAutoOpenDrawerOnCash(settings.autoOpenDrawerOnCash)
  }, [settings])

  const save = async () => {
    setMessage(null)
    try {
      await updateSettings.mutateAsync({
        printerName: printerName || null,
        autoPrintReceipt,
        autoOpenDrawerOnCash,
      })
      setMessage('Configuracoes salvas.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Erro ao salvar.')
    }
  }

  const testPrint = async () => {
    setMessage(null)
    try {
      await printReceipt.mutateAsync({
        saleId: 'TESTE',
        confirmedAt: new Date().toISOString(),
        items: [{ name: 'Item de teste', quantity: 1, totalAmount: 0 }],
        totalAmount: 0,
        paymentLabel: 'Teste de configuracao',
      })
      setMessage('Enviado para a impressora.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Erro ao imprimir.')
    }
  }

  const testDrawer = async () => {
    setMessage(null)
    try {
      await openDrawer.mutateAsync()
      setMessage('Comando de abertura enviado.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Erro ao abrir gaveta.')
    }
  }

  const handleCreateBackup = async () => {
    setBackupMessage(null)
    try {
      await createBackup.mutateAsync()
      setBackupMessage('Backup criado.')
    } catch (e) {
      setBackupMessage(e instanceof Error ? e.message : 'Erro ao criar backup.')
    }
  }

  const handleRestore = async (fileName: string) => {
    setBackupMessage(null)
    try {
      // Sucesso reinicia o backend local e recarrega a janela (Main
      // process) — não há mais nada a fazer aqui depois disso resolver.
      await restoreBackup.mutateAsync(fileName)
    } catch (e) {
      setConfirmRestore(null)
      setBackupMessage(e instanceof Error ? e.message : 'Erro ao restaurar backup.')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Configuracoes"
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            Fechar
          </button>
          <button
            onClick={save}
            disabled={!electron || updateSettings.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {updateSettings.isPending ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      }
    >
      {!electron ? (
        <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
          <WifiOff className="size-4 shrink-0" />
          Configuracoes de hardware so funcionam dentro do aplicativo instalado do EasyPDV
          (nao no navegador de desenvolvimento).
        </div>
      ) : (
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
              <Printer className="size-4" /> Impressora
            </span>
            <select
              value={printerName}
              onChange={(e) => setPrinterName(e.target.value)}
              className="pos-input w-full"
              disabled={loadingPrinters}
            >
              <option value="">Nenhuma (modo simulado)</option>
              {printers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoPrintReceipt}
              onChange={(e) => setAutoPrintReceipt(e.target.checked)}
            />
            Imprimir recibo automaticamente ao confirmar uma venda
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoOpenDrawerOnCash}
              onChange={(e) => setAutoOpenDrawerOnCash(e.target.checked)}
            />
            Abrir a gaveta automaticamente em vendas pagas em dinheiro
          </label>

          <div className="flex gap-2 border-t border-border pt-4">
            <button
              onClick={testPrint}
              disabled={printReceipt.isPending}
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Imprimir teste
            </button>
            <button
              onClick={testDrawer}
              disabled={openDrawer.isPending}
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Abrir gaveta
            </button>
          </div>

          {message && (
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              <Wifi className="size-3.5 shrink-0" />
              {message}
            </div>
          )}

          <div className="space-y-2 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <DatabaseBackup className="size-4" /> Backup local
              </span>
              <button
                onClick={handleCreateBackup}
                disabled={createBackup.isPending}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createBackup.isPending ? 'Criando…' : 'Fazer backup agora'}
              </button>
            </div>

            {!loadingBackups && backups.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum backup ainda.</p>
            ) : (
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {backups.map((b) => (
                  <li key={b.fileName} className="rounded-lg bg-muted/50 px-3 py-2 text-xs">
                    {confirmRestore === b.fileName ? (
                      <div className="space-y-1.5">
                        <p className="text-destructive">
                          Isso vai substituir os dados atuais pelo backup de{' '}
                          {new Date(b.createdAt).toLocaleString('pt-BR')}. Não pode ser desfeito.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setConfirmRestore(null)}
                            disabled={restoreBackup.isPending}
                            className="rounded-md px-2 py-1 font-medium text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => handleRestore(b.fileName)}
                            disabled={restoreBackup.isPending}
                            className="rounded-md bg-destructive px-2 py-1 font-medium text-destructive-foreground hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {restoreBackup.isPending ? 'Restaurando…' : 'Confirmar restauração'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">
                          {new Date(b.createdAt).toLocaleString('pt-BR')} · {formatBytes(b.sizeBytes)}
                        </span>
                        <button
                          onClick={() => setConfirmRestore(b.fileName)}
                          className="flex items-center gap-1 rounded-md px-2 py-1 font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <RotateCcw className="size-3" /> Restaurar
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {backupMessage && <p className="text-xs text-muted-foreground">{backupMessage}</p>}
          </div>
        </div>
      )}
    </Modal>
  )
}
