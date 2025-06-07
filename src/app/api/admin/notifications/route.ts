import { NextRequest, NextResponse } from 'next/server';
import { 
  createNotification, 
  getAllNotifications, 
  deleteNotification, 
  updateNotification,
  isAdminUser 
} from '../../../../lib/admin';

// GET /api/admin/notifications - Get all notifications
export async function GET(request: NextRequest) {
  try {
    const adminEmail = request.headers.get('x-admin-email');
    
    if (!adminEmail || !isAdminUser(adminEmail)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }

    const notifications = await getAllNotifications();
    
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

// POST /api/admin/notifications - Create notification
export async function POST(request: NextRequest) {
  try {
    const adminEmail = request.headers.get('x-admin-email');
    
    if (!adminEmail || !isAdminUser(adminEmail)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { location, title, content, startDate, endDate } = body;
    
    if (!location || !title || !content || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields: location, title, content, startDate, endDate' },
        { status: 400 }
      );
    }

    const validLocations = ['homepage', 'user_dashboard', 'provider_dashboard'];
    if (!validLocations.includes(location)) {
      return NextResponse.json(
        { error: 'Invalid location. Must be: homepage, user_dashboard, or provider_dashboard' },
        { status: 400 }
      );
    }

    const notification = await createNotification(
      location,
      title,
      content,
      startDate,
      endDate,
      adminEmail
    );
    
    return NextResponse.json({
      notification,
      message: 'Notification created successfully',
      success: true
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/notifications - Update notification
export async function PUT(request: NextRequest) {
  try {
    const adminEmail = request.headers.get('x-admin-email');
    
    if (!adminEmail || !isAdminUser(adminEmail)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { notificationId, ...updates } = body;
    
    if (!notificationId) {
      return NextResponse.json(
        { error: 'Missing required field: notificationId' },
        { status: 400 }
      );
    }

    await updateNotification(notificationId, updates, adminEmail);
    
    return NextResponse.json({
      message: 'Notification updated successfully',
      success: true
    });
  } catch (error) {
    console.error('Failed to update notification:', error);
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/notifications - Delete notification
export async function DELETE(request: NextRequest) {
  try {
    const adminEmail = request.headers.get('x-admin-email');
    
    if (!adminEmail || !isAdminUser(adminEmail)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get('notificationId');
    
    if (!notificationId) {
      return NextResponse.json(
        { error: 'Missing required parameter: notificationId' },
        { status: 400 }
      );
    }

    await deleteNotification(notificationId, adminEmail);
    
    return NextResponse.json({
      message: 'Notification deleted successfully',
      success: true
    });
  } catch (error) {
    console.error('Failed to delete notification:', error);
    return NextResponse.json(
      { error: 'Failed to delete notification' },
      { status: 500 }
    );
  }
} 