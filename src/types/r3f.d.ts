import 'react'
import 'react/jsx-runtime'

type ThreeEls = import('@react-three/fiber').ThreeElements

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends ThreeEls {}
  }
}

declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements extends ThreeEls {}
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeEls {}
  }
}
