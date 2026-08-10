import { NextResponse } from 'next/server';
import { generateICalFeed } from '../../../../lib/icalFeed';

export async function GET(request, { params }) {
  try {
    const { token } = await params;

    if (!token) {
      return new NextResponse('Missing subscription token', { status: 400 });
    }

    const icsContent = await generateICalFeed(token);

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="db-atdc-calendar.ics"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('iCal feed error:', error);
    return new NextResponse(error.message || 'Error generating calendar feed', { status: 500 });
  }
}
