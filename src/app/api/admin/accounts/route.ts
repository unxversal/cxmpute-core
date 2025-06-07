import { NextRequest, NextResponse } from 'next/server';
import { 
  suspendAccount, 
  unsuspendAccount, 
  deleteAccount,
  searchUsers,
  searchProviders,
  getUserById,
  getProviderById,
  getAccountActions,
  isAdminUser 
} from '../../../../lib/admin';

// GET /api/admin/accounts - Search users/providers
export async function GET(request: NextRequest) {
  try {
    const adminEmail = request.headers.get('x-admin-email');
    
    if (!adminEmail || !isAdminUser(adminEmail)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const type = searchParams.get('type'); // 'user', 'provider', or 'both'
    const userId = searchParams.get('userId');
    const providerId = searchParams.get('providerId');

    // Get specific user/provider by ID
    if (userId) {
      const user = await getUserById(userId);
      const actions = await getAccountActions(userId);
      return NextResponse.json({ user, actions, success: true });
    }

    if (providerId) {
      const provider = await getProviderById(providerId);
      const actions = await getAccountActions(providerId);
      return NextResponse.json({ provider, actions, success: true });
    }

    // Search functionality
    if (!query) {
      return NextResponse.json(
        { error: 'Missing search query parameter: q' },
        { status: 400 }
      );
    }

    let users: any[] = [];
    let providers: any[] = [];

    if (type === 'user' || type === 'both' || !type) {
      users = await searchUsers(query);
    }

    if (type === 'provider' || type === 'both' || !type) {
      providers = await searchProviders(query);
    }
    
    return NextResponse.json({
      users,
      providers,
      success: true
    });
  } catch (error) {
    console.error('Failed to search accounts:', error);
    return NextResponse.json(
      { error: 'Failed to search accounts' },
      { status: 500 }
    );
  }
}

// POST /api/admin/accounts - Suspend account
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
    const { userId, userType, reason, action } = body;
    
    if (!userId || !userType || !reason || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, userType, reason, action' },
        { status: 400 }
      );
    }

    if (!['user', 'provider'].includes(userType)) {
      return NextResponse.json(
        { error: 'Invalid userType. Must be "user" or "provider"' },
        { status: 400 }
      );
    }

    let result;
    
    switch (action) {
      case 'suspend':
        result = await suspendAccount(userId, userType, reason, adminEmail);
        break;
      case 'unsuspend':
        result = await unsuspendAccount(userId, userType, reason, adminEmail);
        break;
      case 'delete':
        result = await deleteAccount(userId, userType, reason, adminEmail);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be "suspend", "unsuspend", or "delete"' },
          { status: 400 }
        );
    }
    
    return NextResponse.json({
      action: result,
      message: `Account ${action} completed successfully`,
      success: true
    });
  } catch (error) {
    console.error('Failed to perform account action:', error);
    return NextResponse.json(
      { error: 'Failed to perform account action' },
      { status: 500 }
    );
  }
} 