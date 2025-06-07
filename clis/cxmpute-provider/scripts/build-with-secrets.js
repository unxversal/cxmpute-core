#!/usr/bin/env node
// scripts/build-with-secrets.js

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const SECRET_KEY = process.env.CXMPUTE_PROVIDER_SECRET || process.argv[2];
const CONFIG_TEMPLATE_PATH = path.join(__dirname, '../source/lib/config.template.ts');
const CONFIG_OUTPUT_PATH = path.join(__dirname, '../source/lib/config.ts');

if (!SECRET_KEY) {
    console.error('❌ Error: Provider secret not provided');
    console.error('Usage: node scripts/build-with-secrets.js <SECRET_KEY>');
    console.error('   or: CXMPUTE_PROVIDER_SECRET=<key> node scripts/build-with-secrets.js');
    process.exit(1);
}

if (SECRET_KEY.length < 32) {
    console.error('❌ Error: Secret key must be at least 32 characters long');
    process.exit(1);
}

console.log('🔧 Building Cxmpute Provider CLI with embedded secrets...');

try {
    // 1. Read template file
    console.log('📖 Reading config template...');
    const template = fs.readFileSync(CONFIG_TEMPLATE_PATH, 'utf8');
    
    // 2. Replace placeholders
    console.log('🔄 Injecting secrets...');
    const config = template
        .replace('__PROVIDER_SECRET_PLACEHOLDER__', SECRET_KEY)
        .replace('__BUILD_TIME_PLACEHOLDER__', new Date().toISOString());
    
    // 3. Write actual config file
    fs.writeFileSync(CONFIG_OUTPUT_PATH, config);
    console.log('✅ Config file generated');
    
    // 4. Build TypeScript
    console.log('🔨 Compiling TypeScript...');
    execSync('npm run build', { stdio: 'inherit' });
    
    // 5. Create binaries directory
    const binariesDir = path.join(__dirname, '../binaries');
    if (!fs.existsSync(binariesDir)) {
        fs.mkdirSync(binariesDir);
    }
    
    // 6. Build binaries with pkg
    console.log('📦 Building binaries...');
    const targets = [
        'node18-linux-x64',
        'node18-macos-x64',
        'node18-macos-arm64',
        'node18-win-x64'
    ];
    
    for (const target of targets) {
        console.log(`📦 Building for ${target}...`);
        const outputName = target.includes('win') ? 'cxmpute-provider.exe' : 'cxmpute-provider';
        const outputPath = path.join(binariesDir, `${target}-${outputName}`);
        
        try {
            execSync(`npx pkg dist/cli.js --target ${target} --output "${outputPath}"`, { 
                stdio: 'inherit' 
            });
            console.log(`✅ Built: ${outputPath}`);
        } catch (error) {
            console.error(`❌ Failed to build ${target}:`, error.message);
        }
    }
    
    // 7. Clean up config file (security)
    console.log('🧹 Cleaning up temporary files...');
    fs.unlinkSync(CONFIG_OUTPUT_PATH);
    
    console.log('🎉 Build complete! Binaries are in the binaries/ directory');
    console.log('⚠️  Config file has been cleaned up for security');
    
} catch (error) {
    console.error('❌ Build failed:', error.message);
    
    // Clean up on error
    if (fs.existsSync(CONFIG_OUTPUT_PATH)) {
        fs.unlinkSync(CONFIG_OUTPUT_PATH);
    }
    
    process.exit(1);
} 