import { NextRequest, NextResponse } from 'next/server';
import { 
  getAdminDashboardStats,
  isAdminUser 
} from '../../../../lib/admin';
import { 
  getAllPricingConfig,
  isMainnetMode 
} from '../../../../lib/rewards';

// GET /api/admin/dashboard - Get admin dashboard stats
export async function GET(request: NextRequest) {
  try {
    const adminEmail = request.headers.get('x-admin-email');
    
    if (!adminEmail || !isAdminUser(adminEmail)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }

    const [stats, pricing, mainnetMode] = await Promise.all([
      getAdminDashboardStats(),
      getAllPricingConfig(),
      isMainnetMode()
    ]);
    
    return NextResponse.json({
      stats,
      pricing: {
        configs: pricing,
        isMainnet: mainnetMode,
        totalConfigs: pricing.length
      },
      success: true
    });
  } catch (error) {
    console.error('Failed to get admin dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to get admin dashboard stats' },
      { status: 500 }
    );
  }
} 