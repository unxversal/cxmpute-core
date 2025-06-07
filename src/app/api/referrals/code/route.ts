import { NextRequest, NextResponse } from 'next/server';
import { createReferralCode } from '../../../../lib/rewards';

// POST /api/referrals/code - Generate or get referral code for user/provider
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, userType } = body;
    
    if (!userId || !userType) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, userType' },
        { status: 400 }
      );
    }
    
    if (userType !== 'user' && userType !== 'provider') {
      return NextResponse.json(
        { error: 'userType must be either "user" or "provider"' },
        { status: 400 }
      );
    }
    
    const referralCode = await createReferralCode(userId, userType);
    
    return NextResponse.json({
      referralCode,
      message: 'Referral code generated successfully',
      success: true
    });
  } catch (error) {
    console.error('Failed to create referral code:', error);
    return NextResponse.json(
      { error: 'Failed to generate referral code' },
      { status: 500 }
    );
  }
} 