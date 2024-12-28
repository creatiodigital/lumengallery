import { cabin, fraunces } from '@/app/fonts'

import StoreProvider from './storeProvider'
import '@/styles/globals.scss'

export const metadata = {
  title: 'Next.js project',
  description: 'Boilerplate for Next.js projects',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${cabin.variable} ${fraunces.variable}`}>
      <body>
        <StoreProvider>
          <header></header>
          {children}
        </StoreProvider>
      </body>
    </html>
  )
}
