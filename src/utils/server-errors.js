import { NextResponse } from 'next/server'

export function serverError(code, error) {
  return NextResponse.json(
    {
      error: { status: code, message: error },
    },
    { status: code },
  )
}
