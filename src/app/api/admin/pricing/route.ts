import { NextRequest, NextResponse } from 'next/server';
import { 
  isAdminUser 
} from '../../../../lib/admin';
import { 
  setPricingConfig,
  toggleMainnet,
  getAllPricingConfig,
  isMainnetMode
} from '../../../../lib/rewards';

// GET /api/admin/pricing - Get pricing configuration
export async function GET(request: NextRequest) {
  try {
    const adminEmail = request.headers.get('x-admin-email');
    
    if (!adminEmail || !isAdminUser(adminEmail)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }

    const [pricing, mainnetMode] = await Promise.all([
      getAllPricingConfig(),
      isMainnetMode()
    ]);
    
    return NextResponse.json({
      pricing,
      isMainnet: mainnetMode,
      success: true
    });
  } catch (error) {
    console.error('Failed to get pricing config:', error);
    return NextResponse.json(
      { error: 'Failed to get pricing config' },
      { status: 500 }
    );
  }
}

// POST /api/admin/pricing - Update pricing configuration
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
    const { action, service, pricing } = body;

    let result;
    let message;

    switch (action) {
      case 'update_service':
        if (!service || !pricing) {
          return NextResponse.json(
            { error: 'Missing required fields: service, pricing' },
            { status: 400 }
          );
        }
        await setPricingConfig(service, pricing.pricePerUnit, pricing.unit, adminEmail);
        message = `Updated pricing for ${service}`;
        break;

      case 'switch_mainnet':
        await toggleMainnet(true, adminEmail);
        message = 'Switched to mainnet mode (paid services)';
        break;

      case 'switch_testnet':
        await toggleMainnet(false, adminEmail);
        message = 'Switched to testnet mode (free services)';
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be "update_service", "switch_mainnet", or "switch_testnet"' },
          { status: 400 }
        );
    }
    
    return NextResponse.json({
      message,
      success: true
    });
  } catch (error) {
    console.error('Failed to update pricing:', error);
    return NextResponse.json(
      { error: 'Failed to update pricing' },
      { status: 500 }
    );
  }
}

// POST /api/admin/pricing/init - Initialize pricing (run init script)
export async function PUT(request: NextRequest) {
  try {
    const adminEmail = request.headers.get('x-admin-email');
    
    if (!adminEmail || !isAdminUser(adminEmail)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { mode } = body; // 'testnet' or 'mainnet'

    if (!mode || !['testnet', 'mainnet'].includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid mode. Must be "testnet" or "mainnet"' },
        { status: 400 }
      );
    }

    // Run init pricing logic inline
    if (mode === 'testnet') {
      // Set all pricing to 0 for testnet
      const testnetPricing = [
        { key: 'tide_pool_input', price: 0, unit: '1000_tokens' },
        { key: 'blue_surge_input', price: 0, unit: '1000_tokens' },
        { key: 'open_ocean_input', price: 0, unit: '1000_tokens' },
        { key: 'mariana_depth_input', price: 0, unit: '1000_tokens' },
        { key: 'tide_pool_output', price: 0, unit: '1000_tokens' },
        { key: 'blue_surge_output', price: 0, unit: '1000_tokens' },
        { key: 'open_ocean_output', price: 0, unit: '1000_tokens' },
        { key: 'mariana_depth_output', price: 0, unit: '1000_tokens' },
        { key: 'embeddings', price: 0, unit: '1000_tokens' },
        { key: 'tts', price: 0, unit: 'minute' },
        { key: 'scrape', price: 0, unit: 'request' },
      ];
      
      for (const config of testnetPricing) {
        await setPricingConfig(config.key, config.price, config.unit, adminEmail);
      }
      await toggleMainnet(false, adminEmail);
      
    } else {
      // Set mainnet pricing
      const mainnetPricing = [
        { key: 'tide_pool_input', price: 0.0002, unit: '1000_tokens' },
        { key: 'blue_surge_input', price: 0.0005, unit: '1000_tokens' },
        { key: 'open_ocean_input', price: 0.0015, unit: '1000_tokens' },
        { key: 'mariana_depth_input', price: 0.0040, unit: '1000_tokens' },
        { key: 'tide_pool_output', price: 0.0004, unit: '1000_tokens' },
        { key: 'blue_surge_output', price: 0.0010, unit: '1000_tokens' },
        { key: 'open_ocean_output', price: 0.0030, unit: '1000_tokens' },
        { key: 'mariana_depth_output', price: 0.0080, unit: '1000_tokens' },
        { key: 'embeddings', price: 0.0001, unit: '1000_tokens' },
        { key: 'tts', price: 0.015, unit: 'minute' },
        { key: 'scrape', price: 0.001, unit: 'request' },
      ];
      
      for (const config of mainnetPricing) {
        await setPricingConfig(config.key, config.price, config.unit, adminEmail);
      }
      await toggleMainnet(true, adminEmail);
    }
    
    return NextResponse.json({
      message: `Pricing initialized in ${mode} mode`,
      success: true
    });
  } catch (error) {
    console.error('Failed to initialize pricing:', error);
    return NextResponse.json(
      { error: 'Failed to initialize pricing' },
      { status: 500 }
    );
  }
} 