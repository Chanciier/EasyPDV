'use client'

import { useEffect } from 'react'
import { usePrintReceipt } from '@/hooks/use-hardware'
import { useFiscalStatus } from '@/hooks/use-sales'
import { useFiscalPrintStore } from '@/lib/fiscal-print-store'

/**
 * Sem UI própria — só acompanha a NFC-e pendente (se houver) em segundo
 * plano e dispara a impressão fiscal assim que ela ficar pronta. Precisa
 * ficar montado fora do switch de views (pos-shell.tsx), não dentro de
 * SaleView — ver comentário em lib/fiscal-print-store.ts pro porquê.
 */
export function FiscalPrintWatcher() {
  const pending = useFiscalPrintStore((s) => s.pending)
  const clear = useFiscalPrintStore((s) => s.clear)
  const printReceipt = usePrintReceipt()
  const { data: status } = useFiscalStatus(pending?.saleId ?? null, { pollWhilePending: true })

  // Assim que a NFC-e ficar "issued", imprime sozinho. "error" (ex:
  // NCM/CSC faltando na conta Bling) desiste da espera automática; ainda dá
  // pra imprimir manualmente depois, quando a configuração for corrigida e
  // a nota reemitida.
  useEffect(() => {
    if (!pending || !status) return
    if (status.status === 'issued') {
      const { documentNumber, accessKey, qrCodeUrl } = status
      if (documentNumber && accessKey && qrCodeUrl) {
        printReceipt.mutate({ ...pending.basePayload, fiscal: { documentNumber, accessKey, qrCodeUrl } })
      }
      clear()
    } else if (status.status === 'error') {
      clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  // Desiste depois de alguns minutos (conta sem certificado/CSC configurado
  // pode nunca emitir) — não trava o polling pra sempre.
  useEffect(() => {
    if (!pending) return
    const timeout = setTimeout(clear, 3 * 60 * 1000)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending?.saleId])

  return null
}
