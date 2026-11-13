import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Sistema de Orçamentos | Propostas Comerciais',
  description: 'Gerador profissional de orçamentos com papel timbrado e identificação do vendedor',
  icons: {
    icon: '/Logo_mini_red.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
