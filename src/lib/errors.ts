import { NextResponse } from 'next/server'

export class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export function errorHandler(error: unknown) {
  console.error('[API Error]', error)

  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode }
    )
  }

  const message = error instanceof Error ? error.message : 'Unknown error'
  return NextResponse.json(
    { error: message },
    { status: 500 }
  )
}
