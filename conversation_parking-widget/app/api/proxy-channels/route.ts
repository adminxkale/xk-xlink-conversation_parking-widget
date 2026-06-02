import { NextResponse } from 'next/server';

export async function GET() {
  // TODO: Replace with actual API call
  // id must match phone_number so the interactions API receives the real number
  const mockChannels = [
    { id: '12053505800', phone_number_id: '12053505800', phone_number: '12053505800', name: '12053505800' },
  ];

  return NextResponse.json(mockChannels);
}
