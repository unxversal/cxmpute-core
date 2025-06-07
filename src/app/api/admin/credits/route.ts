import { NextRequest, NextResponse } from 'next/server';
import { 
  addUserCredits, 
  getUserCredits 
} from '../../../../lib/rewards';

// POST /api/admin/credits - Add credits to a user account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, amount, reason } = body;
    
    if (!userId || amount === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, amount' },
        { status: 400 }
      );
    }
    
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }
    
    const updatedCredits = await addUserCredits(userId, amount, reason);
    
    return NextResponse.json({
      message: 'Credits added successfully',
      credits: updatedCredits,
      success: true
    });
  } catch (error) {
    console.error('Failed to add user credits:', error);
    return NextResponse.json(
      { error: 'Failed to add credits to user account' },
      { status: 500 }
    );
  }
}

// GET /api/admin/credits?userId=xxx - Get user credit balance
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required parameter: userId' },
        { status: 400 }
      );
    }
    
    const credits = await getUserCredits(userId);
    
    if (!credits) {
      return NextResponse.json(
        { error: 'User not found or no credit record exists' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      credits,
      success: true
    });
  } catch (error) {
    console.error('Failed to get user credits:', error);
    return NextResponse.json(
      { error: 'Failed to get user credits' },
      { status: 500 }
    );
  }
} 