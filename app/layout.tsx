import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/components/AuthProvider'
import Layout from '@/components/Layout'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Orderli take over Dashboard',
  description: 'Dashboard for recruiters to manage visits to hospitality locations',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <Layout>
            {children}
          </Layout>
        </AuthProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  )
}
