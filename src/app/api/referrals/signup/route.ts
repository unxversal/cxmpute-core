import { NextRequest, NextResponse } from 'next/server';
import { processReferral } from '../../../../lib/rewards';

// POST /api/referrals/signup - Process a referral when someone signs up
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { referralCode, refereeId, refereeType } = body;
    
    if (!referralCode || !refereeId || !refereeType) {
      return NextResponse.json(
        { error: 'Missing required fields: referralCode, refereeId, refereeType' },
        { status: 400 }
      );
    }
    
    if (refereeType !== 'user' && refereeType !== 'provider') {
      return NextResponse.json(
        { error: 'refereeType must be either "user" or "provider"' },
        { status: 400 }
      );
    }
    
    const success = await processReferral(referralCode, refereeId, refereeType);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Invalid referral code or user already referred' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      message: 'Referral processed successfully',
      success: true
    });
  } catch (error) {
    console.error('Failed to process referral:', error);
    return NextResponse.json(
      { error: 'Failed to process referral' },
      { status: 500 }
    );
  }
} 