# 🔨 Cxmpute Provider CLI - Build & Release Guide

## 🚀 Automated GitHub Releases

This CLI uses GitHub Actions to automatically build and release binaries when code is pushed to the `releases` branch.

### **Setup Instructions**

#### **1. Set GitHub Secret**

Go to your repository settings → Secrets and variables → Actions → New repository secret:

- **Name**: `CXMPUTE_PROVIDER_SECRET`
- **Value**: Your provider registration secret (must be 32+ characters)

#### **2. Create Releases Branch**

```bash
# Create and switch to releases branch
git checkout -b releases

# Push to trigger first release
git push origin releases
```

#### **3. Trigger Releases**

**Automatic Releases:**
- Push CLI changes to the `releases` branch
- Workflow triggers automatically
- Binaries are built and attached to a GitHub release

**Manual Releases:**
- Go to Actions → "🚀 Release Cxmpute Provider CLI"
- Click "Run workflow"
- Specify version (e.g., `v1.2.0`)

### **Release Artifacts**

Each release includes cross-platform binaries:
- `node18-linux-x64-cxmpute-provider` (Linux x64)
- `node18-macos-x64-cxmpute-provider` (macOS Intel)
- `node18-macos-arm64-cxmpute-provider` (macOS Apple Silicon)
- `node18-win-x64-cxmpute-provider.exe` (Windows)

## 🛠️ Local Development Builds

### **With Environment Variable (Development)**

```bash
# Set your development secret
export CXMPUTE_PROVIDER_SECRET="your_dev_secret_here"

# Build and run
npm run build
node dist/cli.js
```

### **With Embedded Secret (Production)**

```bash
# Build with embedded secret
CXMPUTE_PROVIDER_SECRET="your_secret" npm run build:secure

# Or using the script directly
node scripts/build-with-secrets.js "your_secret_here"
```

## 🔐 Security Features

- **Secrets never appear in repository**
- **Build-time secret injection**
- **Automatic cleanup after build**
- **Embedded authentication in binaries**
- **No runtime environment variables needed**

## 📋 Version Management

The workflow automatically extracts version from:
1. Manual workflow input (if triggered manually)
2. `package.json` version field
3. Git commit hash (fallback)

Update `package.json` version before pushing to `releases` branch for versioned releases.

## 🧹 File Structure

```
clis/cxmpute-provider/
├── source/lib/
│   ├── config.template.ts     # Template with placeholders
│   └── config.ts             # Generated (gitignored)
├── scripts/
│   └── build-with-secrets.js # Build script
├── binaries/                 # Built executables (gitignored)
└── .github/workflows/
    └── release-cli.yml       # GitHub Actions workflow
```

## 🚨 Important Notes

1. **Never commit `source/lib/config.ts`** - it contains secrets
2. **Secrets are embedded at build time** - users don't need env vars
3. **Only push to `releases` branch when ready** - triggers automatic release
4. **Binaries are signed and distributed via GitHub Releases**

## 🐛 Troubleshooting

**Build fails with "missing secret":**
- Check GitHub secret `CXMPUTE_PROVIDER_SECRET` is set
- Ensure secret is 32+ characters long

**Permission denied errors:**
- Make sure binaries are executable: `chmod +x cxmpute-provider`

**Import errors during development:**
- `config.ts` doesn't exist in development - that's normal
- Use environment variable `CXMPUTE_PROVIDER_SECRET` for dev builds 