import { NextRequest, NextResponse } from 'next/server';
import { getActiveNotifications } from '../../../lib/admin';

// GET /api/notifications - Get active notifications for a location
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get('location') as "homepage" | "user_dashboard" | "provider_dashboard";
    
    if (!location || !['homepage', 'user_dashboard', 'provider_dashboard'].includes(location)) {
      return NextResponse.json(
        { error: 'Invalid or missing location parameter' },
        { status: 400 }
      );
    }

    const notifications = await getActiveNotifications(location);
    
    return NextResponse.json({
      notifications,
      success: true
    });
  } catch (error) {
    console.error('Failed to get notifications:', error);
    return NextResponse.json(
      { error: 'Failed to get notifications' },
      { status: 500 }
    );
  }
} 