'use client'

import { useEffect, useState } from 'react'
import { Printer, Wifi, WifiOff } from 'lucide-react'
import { Modal } from './ui/modal'
import {
  isElectron,
  useHardwareSettings,
  useOpenDrawer,
  usePrinterList,
  usePrintReceipt,
  useUpdateHardwareSettings,
} from '@/hooks/use-hardware'

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const electron = isElectron()
  const { data: settings } = useHardwareSettings()
  const { data: printers = [], isLoading: loadingPrinters } = usePrinterList()
  const updateSettings = useUpdateHardwareSettings()
  const printReceipt = usePrintReceipt()
  const openDrawer = useOpenDrawer()

  const [printerName, setPrinterName] = useState('')
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(true)
  const [autoOpenDrawerOnCash, setAutoOpenDrawerOnCash] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

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
        </div>
      )}
    </Modal>
  )
}
