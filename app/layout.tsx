import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ClientLayout from './components/Layout'
import { LayoutProvider } from './contexts/LayoutContext'
import { ModalProvider } from './contexts/ModalContext'
import { AlertsProvider } from './contexts/AlertsContext'

const inter = Inter({ 
  subsets: ['latin'],
  fallback: ['system-ui', 'arial']
})

export const metadata: Metadata = {
  title: 'Pachinko',
  description: 'TeamSpark Pachinko - MCP Server policy application',
  icons: {
    icon: '/icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ModalProvider>
          <LayoutProvider>
            <AlertsProvider>
              <ClientLayout>
                {children}
              </ClientLayout>
            </AlertsProvider>
          </LayoutProvider>
        </ModalProvider>
      </body>
    </html>
  );
} 