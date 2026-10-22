import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Providers } from './providers'
import './globals.css'

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

export const metadata: Metadata = {
  title: 'EasyPDV — Ponto de Venda',
  description: 'Sistema de ponto de venda rápido e eficiente, keyboard-first.',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f5c518',
}

/**
 * Sem `<Analytics />` (Vercel) desde 2026-10-22: o app roda em `file://`
 * dentro do Electron — o script só falhava na rede no boot e mandaria
 * telemetria de um PDV para terceiro. A dependência fica no package.json
 * para não mexer no lockfile.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`light ${geistSans.variable} ${geistMono.variable}`}>
      <body className="bg-background font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
