#!/usr/bin/env tsx

// src/scripts/init-pricing.ts
// Script to initialize default pricing configuration for testnet mode

import { setPricingConfig, toggleMainnet } from '../lib/rewards';

const ADMIN_USER_ID = 'system-admin';

// Default testnet pricing (all free)
const DEFAULT_PRICING = [
  // Chat completion tiers - input tokens
  { key: 'tide_pool_input', price: 0, unit: '1000_tokens' },
  { key: 'blue_surge_input', price: 0, unit: '1000_tokens' },
  { key: 'open_ocean_input', price: 0, unit: '1000_tokens' },
  { key: 'mariana_depth_input', price: 0, unit: '1000_tokens' },
  
  // Chat completion tiers - output tokens
  { key: 'tide_pool_output', price: 0, unit: '1000_tokens' },
  { key: 'blue_surge_output', price: 0, unit: '1000_tokens' },
  { key: 'open_ocean_output', price: 0, unit: '1000_tokens' },
  { key: 'mariana_depth_output', price: 0, unit: '1000_tokens' },
  
  // Other services
  { key: 'embeddings', price: 0, unit: '1000_tokens' },
  { key: 'tts', price: 0, unit: 'minute' },
  { key: 'scrape', price: 0, unit: 'request' },
];

// Mainnet pricing (from pricing.md)
const MAINNET_PRICING = [
  // Chat completion tiers - input tokens  
  { key: 'tide_pool_input', price: 0.0002, unit: '1000_tokens' },
  { key: 'blue_surge_input', price: 0.0005, unit: '1000_tokens' },
  { key: 'open_ocean_input', price: 0.0015, unit: '1000_tokens' },
  { key: 'mariana_depth_input', price: 0.0040, unit: '1000_tokens' },
  
  // Chat completion tiers - output tokens
  { key: 'tide_pool_output', price: 0.0004, unit: '1000_tokens' },
  { key: 'blue_surge_output', price: 0.0010, unit: '1000_tokens' },
  { key: 'open_ocean_output', price: 0.0030, unit: '1000_tokens' },
  { key: 'mariana_depth_output', price: 0.0080, unit: '1000_tokens' },
  
  // Other services
  { key: 'embeddings', price: 0.0001, unit: '1000_tokens' },
  { key: 'tts', price: 0.015, unit: 'minute' },
  { key: 'scrape', price: 0.001, unit: 'request' },
];

async function initTestnetPricing() {
  console.log('🚀 Initializing testnet pricing (all services free)...');
  
  try {
    // Set all pricing to 0 for testnet
    for (const config of DEFAULT_PRICING) {
      await setPricingConfig(config.key, config.price, config.unit, ADMIN_USER_ID);
      console.log(`✅ Set ${config.key}: $${config.price} per ${config.unit}`);
    }
    
    // Ensure we're in testnet mode
    await toggleMainnet(false, ADMIN_USER_ID);
    console.log('✅ Set to testnet mode (free services)');
    
    console.log('\n🎉 Testnet pricing initialized successfully!');
    console.log('All services are now free for testing.');
    
  } catch (error) {
    console.error('❌ Failed to initialize pricing:', error);
    process.exit(1);
  }
}

async function initMainnetPricing() {
  console.log('💰 Initializing mainnet pricing...');
  
  try {
    // Set mainnet pricing
    for (const config of MAINNET_PRICING) {
      await setPricingConfig(config.key, config.price, config.unit, ADMIN_USER_ID);
      console.log(`✅ Set ${config.key}: $${config.price} per ${config.unit}`);
    }
    
    // Switch to mainnet mode
    await toggleMainnet(true, ADMIN_USER_ID);
    console.log('✅ Set to mainnet mode (paid services)');
    
    console.log('\n🎉 Mainnet pricing initialized successfully!');
    console.log('Services are now using production pricing.');
    
  } catch (error) {
    console.error('❌ Failed to initialize mainnet pricing:', error);
    process.exit(1);
  }
}

// Main function
async function main() {
  const mode = process.argv[2];
  
  if (mode === 'testnet') {
    await initTestnetPricing();
  } else if (mode === 'mainnet') {
    await initMainnetPricing();
  } else {
    console.log('Usage: tsx src/scripts/init-pricing.ts [testnet|mainnet]');
    console.log('');
    console.log('Examples:');
    console.log('  tsx src/scripts/init-pricing.ts testnet   # Set all services to free');
    console.log('  tsx src/scripts/init-pricing.ts mainnet   # Set production pricing');
    process.exit(1);
  }
}

// Run the script
main().catch(console.error); 