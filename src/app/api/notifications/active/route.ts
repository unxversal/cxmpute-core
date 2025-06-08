import { NextRequest, NextResponse } from 'next/server';
import { Resource } from 'sst';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const motif = searchParams.get('motif');
    
    if (!motif || !['homepage', 'userDashboard', 'providerDashboard'].includes(motif)) {
      return NextResponse.json(
        { error: 'Invalid or missing motif parameter' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    
    // Query notifications by motif
    const queryCommand = new QueryCommand({
      TableName: Resource.NotificationsTable.name,
      IndexName: 'ByMotif',
      KeyConditionExpression: 'motif = :motif',
      FilterExpression: 'startDate <= :now AND (attribute_not_exists(endDate) OR endDate > :now)',
      ExpressionAttributeValues: {
        ':motif': motif,
        ':now': now
      }
    });

    const result = await dynamodb.send(queryCommand);
    
    // Filter for truly active notifications
    const activeNotifications = (result.Items || []).filter(notification => {
      const startTime = new Date(notification.startDate).getTime();
      const endTime = notification.endDate ? new Date(notification.endDate).getTime() : null;
      const nowTime = Date.now();
      
      // Check if notification is currently active
      const isCurrentlyActive = startTime <= nowTime && (!endTime || endTime > nowTime);
      
      return isCurrentlyActive;
    });

    // Sort by start date (most recent first)
    activeNotifications.sort((a, b) => 
      new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );

    return NextResponse.json({
      notifications: activeNotifications,
      count: activeNotifications.length
    });

  } catch (error) {
    console.error('Error fetching active notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 