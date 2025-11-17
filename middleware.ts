import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const allowedOrigins = [
  'https://control-de-reserva-de-combustible.vercel.app',
  'http://localhost:3000'
]

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin') || ''
  const isAllowedOrigin = allowedOrigins.includes(origin) || !origin

  const response = NextResponse.next()

  if (isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin)
  }
  
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { 
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true'
      }
    })
  }

  return response
}

export const config = {
  matcher: '/api/:path*',
}
