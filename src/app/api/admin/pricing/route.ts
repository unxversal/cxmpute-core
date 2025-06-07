import { NextRequest, NextResponse } from 'next/server';
import { 
  setPricingConfig, 
  getAllPricingConfig, 
  toggleMainnet,
  isMainnetMode 
} from '../../../../lib/rewards';

// GET /api/admin/pricing - Get all pricing configuration
export async function GET() {
  try {
    const pricing = await getAllPricingConfig();
    const isMainnet = await isMainnetMode();
    
    return NextResponse.json({
      pricing,
      isMainnet,
      success: true
    });
  } catch (error) {
    console.error('Failed to get pricing config:', error);
    return NextResponse.json(
      { error: 'Failed to get pricing configuration' },
      { status: 500 }
    );
  }
}

// POST /api/admin/pricing - Set pricing configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { configKey, pricePerUnit, unit, updatedBy } = body;
    
    if (!configKey || pricePerUnit === undefined || !unit || !updatedBy) {
      return NextResponse.json(
        { error: 'Missing required fields: configKey, pricePerUnit, unit, updatedBy' },
        { status: 400 }
      );
    }
    
    await setPricingConfig(configKey, pricePerUnit, unit, updatedBy);
    
    return NextResponse.json({
      message: 'Pricing configuration updated successfully',
      success: true
    });
  } catch (error) {
    console.error('Failed to set pricing config:', error);
    return NextResponse.json(
      { error: 'Failed to update pricing configuration' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/pricing - Toggle mainnet mode
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { isMainnet, updatedBy } = body;
    
    if (typeof isMainnet !== 'boolean' || !updatedBy) {
      return NextResponse.json(
        { error: 'Missing required fields: isMainnet (boolean), updatedBy' },
        { status: 400 }
      );
    }
    
    await toggleMainnet(isMainnet, updatedBy);
    
    return NextResponse.json({
      message: `Successfully switched to ${isMainnet ? 'mainnet' : 'testnet'} mode`,
      isMainnet,
      success: true
    });
  } catch (error) {
    console.error('Failed to toggle mainnet mode:', error);
    return NextResponse.json(
      { error: 'Failed to toggle mainnet mode' },
      { status: 500 }
    );
  }
} 