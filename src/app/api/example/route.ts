// app/api/example/route.ts
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { 
      message: 'This is a public API endpoint',
      request
    },
    {
      headers: {
        'Access-Control-Allow-Origin': '*', // Allow all domains to access
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}

// Handle preflight requests
export async function OPTIONS() {
  return NextResponse.json(
    {
        message: 'Hello from the OPTIONS method',
    },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}