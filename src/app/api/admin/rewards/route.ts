import { NextRequest, NextResponse } from 'next/server';
import { 
  getProviderRewards,
  getUserPoints,
  getProviderLeaderboard,
  getUserLeaderboard 
} from '../../../../lib/rewards';

// GET /api/admin/rewards - Get rewards data for admin dashboard
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'provider' | 'user' | 'leaderboard'
    const id = searchParams.get('id'); // userId or providerId
    const month = searchParams.get('month'); // YYYY-MM format

    if (type === 'leaderboard') {
      // Get leaderboards for both providers and users
      const [providerLeaderboard, userLeaderboard] = await Promise.all([
        getProviderLeaderboard(month || undefined),
        getUserLeaderboard(month || undefined)
      ]);

      return NextResponse.json({
        providers: providerLeaderboard.slice(0, 50), // Top 50
        users: userLeaderboard.slice(0, 50), // Top 50
        month: month || getCurrentMonth(),
        success: true
      });
    }

    if (type === 'provider' && id) {
      // Get specific provider rewards
      const rewards = await getProviderRewards(id, month || undefined);
      
      if (!rewards) {
        return NextResponse.json(
          { error: 'Provider rewards not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        rewards,
        success: true
      });
    }

    if (type === 'user' && id) {
      // Get specific user points
      const points = await getUserPoints(id, month || undefined);
      
      if (!points) {
        return NextResponse.json(
          { error: 'User points not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        points,
        success: true
      });
    }

    return NextResponse.json(
      { error: 'Invalid request. Specify type=leaderboard or type=provider/user with id parameter' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Failed to get rewards data:', error);
    return NextResponse.json(
      { error: 'Failed to get rewards data' },
      { status: 500 }
    );
  }
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
} 