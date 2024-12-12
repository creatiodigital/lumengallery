import { Cabin, Fraunces } from 'next/font/google'
import StoreProvider from './storeProvider'
import '@/styles/globals.scss'

const cabin = Cabin({ subsets: ['latin'] })
const fraunces = Fraunces({ subsets: ['latin'] })

export const metadata = {
  title: 'Next.js project',
  description: 'Boilerplate for Next.js projects',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${cabin.variable} ${fraunces.variable}`}>
        <StoreProvider>
          <header></header>
          {children}
        </StoreProvider>
      </body>
    </html>
  )
}
