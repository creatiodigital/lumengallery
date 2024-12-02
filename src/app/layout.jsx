import { Inter } from 'next/font/google'
import StoreProvider from './storeProvider'
import '@/styles/globals.scss'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Next.js project',
  description: 'Boilerplate for Next.js projects',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <StoreProvider>
          <header></header>
          {children}
        </StoreProvider>
      </body>
    </html>
  )
}
