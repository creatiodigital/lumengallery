import { cabin, fraunces, roboto, lora } from '@/app/fonts'

import StoreProvider from '@/app/storeProvider'
import '@/styles/globals.scss'

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${cabin.variable} ${fraunces.variable} ${roboto.variable} ${lora.variable}`}
    >
      <body>
        <StoreProvider>
          <header></header>
          {children}
        </StoreProvider>
      </body>
    </html>
  )
}
