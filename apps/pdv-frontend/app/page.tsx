import { POSProvider } from '@/components/pos/pos-provider'
import { POSShell } from '@/components/pos/pos-shell'

export default function Page() {
  return (
    <POSProvider>
      <POSShell />
    </POSProvider>
  )
}
