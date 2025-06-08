import { NextRequest, NextResponse } from 'next/server';
import { Resource } from 'sst';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { requireAdmin } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// GET - Fetch all notifications
export async function GET() {
  try {
    await requireAdmin();

    const scanCommand = new ScanCommand({
      TableName: Resource.NotificationsTable.name
    });

    const result = await dynamodb.send(scanCommand);

    // Sort by most recent first
    const notifications = (result.Items || []).sort((a, b) => 
      new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()
    );

    return NextResponse.json({
      notifications,
      count: notifications.length
    });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create new notification
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    
    const { title, content, motif, startDate, endDate, adminId } = await request.json();
    
    if (!title || !content || !motif || !startDate || !adminId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!['homepage', 'userDashboard', 'providerDashboard'].includes(motif)) {
      return NextResponse.json(
        { error: 'Invalid motif' },
        { status: 400 }
      );
    }

    const notificationId = uuidv4();
    const now = new Date().toISOString();
    
    // Determine status based on dates
    const startTime = new Date(startDate).getTime();
    const endTime = endDate ? new Date(endDate).getTime() : null;
    const nowTime = Date.now();
    
    let status = 'scheduled';
    if (startTime <= nowTime && (!endTime || endTime > nowTime)) {
      status = 'active';
    } else if (endTime && endTime <= nowTime) {
      status = 'expired';
    }

    const notification = {
      notificationId,
      title: title.trim(),
      content: content.trim(),
      motif,
      startDate,
      endDate,
      status,
      createdDate: now,
      createdBy: adminId,
      isActive: status === 'active'
    };

    const putCommand = new PutCommand({
      TableName: Resource.NotificationsTable.name,
      Item: notification
    });

    await dynamodb.send(putCommand);

    console.log(`Admin ${admin.properties.email} created notification: ${title}`);

    return NextResponse.json({
      success: true,
      message: 'Notification created successfully',
      notification
    });

  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 