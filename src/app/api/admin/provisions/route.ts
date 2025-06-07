import { NextRequest, NextResponse } from 'next/server';
import { 
  disconnectAllProvisions,
  disconnectProviderProvisions, 
  disconnectSpecificProvision,
  isAdminUser 
} from '../../../../lib/admin';

// DELETE /api/admin/provisions - Disconnect provisions
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
    const action = searchParams.get('action'); // 'all', 'provider', 'specific'
    const providerId = searchParams.get('providerId');
    const provisionId = searchParams.get('provisionId');

    let result;
    let message;

    switch (action) {
      case 'all':
        result = await disconnectAllProvisions(adminEmail);
        message = `Disconnected ${result} provisions`;
        break;
        
      case 'provider':
        if (!providerId) {
          return NextResponse.json(
            { error: 'Missing providerId parameter for provider action' },
            { status: 400 }
          );
        }
        result = await disconnectProviderProvisions(providerId, adminEmail);
        message = `Disconnected ${result} provisions for provider ${providerId}`;
        break;
        
      case 'specific':
        if (!provisionId) {
          return NextResponse.json(
            { error: 'Missing provisionId parameter for specific action' },
            { status: 400 }
          );
        }
        await disconnectSpecificProvision(provisionId, adminEmail);
        message = `Disconnected provision ${provisionId}`;
        result = 1;
        break;
        
      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be "all", "provider", or "specific"' },
          { status: 400 }
        );
    }
    
    return NextResponse.json({
      disconnectedCount: result,
      message,
      success: true
    });
  } catch (error) {
    console.error('Failed to disconnect provisions:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect provisions' },
      { status: 500 }
    );
  }
} 