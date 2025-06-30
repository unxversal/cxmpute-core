# 🚀 Getting Started - Cxmpute Provider

Transform your computer into an AI compute provider and start earning rewards! This guide will walk you through downloading, installing, and running the Cxmpute Provider CLI.

## 📋 What is Cxmpute Provider?

The Cxmpute Provider CLI turns your computer into a node in the Cxmpute network, allowing you to:
- **💰 Earn rewards** by providing AI compute services (LLMs, embeddings, scraping, TTS)
- **🔄 Auto-orchestrate** services based on your hardware capabilities
- **📊 Track earnings** with a real-time dashboard
- **🌐 Connect globally** to users needing AI compute power

## ⚙️ System Requirements

### **Minimum Requirements**
- **OS**: macOS 10.15+, Linux (Ubuntu 18.04+, CentOS 7+), Windows 10+
- **RAM**: 4GB+ (8GB+ recommended for LLM services)
- **Storage**: 10GB+ free space
- **Internet**: Stable broadband connection

### **Optimal Requirements**
- **GPU**: NVIDIA GPU with 8GB+ VRAM (for LLM hosting)
- **RAM**: 16GB+ (32GB+ for large models)
- **CPU**: Multi-core processor (Intel i5/AMD Ryzen 5+)
- **Internet**: High-speed connection (100+ Mbps)

## 📦 Installation

### **Option 1: npm (Recommended)**

If you have Node.js installed (16+):

```bash
npm install -g @unxversallabs/cxmpute-provider
cxmpute-provider
```

✅ **Advantages**: Easy updates, automatic PATH setup, works on all platforms

### **Option 2: Download Binary**

Go to the [latest release](https://github.com/unxversal/cxmpute-core/releases/latest) and download:

#### **🍎 macOS**
- **Intel Macs (x64)**: `cxmpute-provider-macos` or `cxmpute-provider-macos-intel`
- **Apple Silicon (M1/M2/M3/M4)**: `cxmpute-provider-macos-arm64` or `cxmpute-provider-macos-m1`

#### **🐧 Linux**
- **x64**: `cxmpute-provider-linux`

#### **🪟 Windows**
- **x64**: `cxmpute-provider.exe` or `cxmpute-provider-windows.exe`

### **Step 2: Make Executable (macOS/Linux)**

```bash
# Navigate to your Downloads folder
cd ~/Downloads

# Make the file executable
chmod +x cxmpute-provider-macos    # or cxmpute-provider-linux
```

### **Step 3: Run the Provider**

#### **🍎 macOS**
```bash
# Run directly
./cxmpute-provider-macos

# First time? macOS might show security warning:
# Go to System Preferences > Security & Privacy > General
# Click "Allow Anyway" for cxmpute-provider-macos
```

#### **🐧 Linux**
```bash
# Run directly
./cxmpute-provider-linux
```

#### **🪟 Windows**
```cmd
# Run directly (double-click or command line)
cxmpute-provider.exe

# First time? Windows might show SmartScreen warning:
# Click "More info" > "Run anyway"
```

## 🌟 Install Binary Globally (Optional)

Make the downloaded binary available from anywhere on your system:

### **🍎 macOS**
```bash
# Install globally
sudo mv ~/Downloads/cxmpute-provider-macos /usr/local/bin/cxmpute-provider

# Now run from anywhere
cxmpute-provider
```

### **🐧 Linux**
```bash
# Install globally
sudo mv ~/Downloads/cxmpute-provider-linux /usr/local/bin/cxmpute-provider

# Now run from anywhere
cxmpute-provider
```

### **🪟 Windows**

**Option 1: System32 (requires admin)**
```cmd
# Open Command Prompt as Administrator
move "%USERPROFILE%\Downloads\cxmpute-provider.exe" "C:\Windows\System32\cxmpute-provider.exe"

# Now run from anywhere
cxmpute-provider
```

**Option 2: Add to PATH**
1. Create folder: `C:\cxmpute\`
2. Move `cxmpute-provider.exe` to `C:\cxmpute\`
3. Add `C:\cxmpute\` to your PATH environment variable
4. Restart Command Prompt/PowerShell
5. Run: `cxmpute-provider`

## 🎯 First Run

When you first run the provider, you'll see:

```
 ██████╗██╗  ██╗███╗   ███╗██████╗ ██╗   ██╗████████╗███████╗
██╔════╝╚██╗██╔╝████╗ ████║██╔══██╗██║   ██║╚══██╔══╝██╔════╝
██║      ╚███╔╝ ██╔████╔██║██████╔╝██║   ██║   ██║   █████╗  
██║      ██╔██╗ ██║╚██╔╝██║██╔═══╝ ██║   ██║   ██║   ██╔══╝  
╚██████╗██╔╝ ██╗██║ ╚═╝ ██║██║     ╚██████╔╝   ██║   ███████╗
 ╚═════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝      ╚═════╝    ╚═╝   ╚══════╝

🔧 SETUP WIZARD
```

The CLI will guide you through:
1. **Hardware Detection**: Automatic system profiling
2. **Provider Registration**: Creating your provider account
3. **Service Configuration**: Selecting services based on your hardware
4. **Network Setup**: Configuring tunnels and connectivity

## 📊 Dashboard Overview

Once running, you'll see your provider dashboard:

```
╭────────────────────────────────────────────────────────╮
│ PROVIDER/REFERRAL ID: abc123...                        │
╰────────────────────────────────────────────────────────╯

╭────────────────────────────────────────────────────────╮
│ ● STATUS: ACTIVE                                       │
╰────────────────────────────────────────────────────────╯

╭──────────────────────────╮ ╭───────────────────────────╮
│ TODAY'S EARNINGS: $12.45 │ │ ALL TIME EARNINGS: $342.10│
╰──────────────────────────╯ ╰───────────────────────────╯

╭────────────────────────────────────────────────────────╮
│ REFERRALS: 3                    LEARN MORE             │
╰────────────────────────────────────────────────────────╯

╭────────────────────────────────────────────────────────╮
│ DEVICE TIER: Deep Ocean (Tier 4 - 22GB+ VRAM)         │
╰────────────────────────────────────────────────────────╯
```

## 💰 Earning Rewards

### **Service Types & Earnings**
- **🤖 LLM Inference**: $0.10-0.50 per 1K tokens (varies by model)
- **🔍 Embeddings**: $0.01-0.05 per 1K tokens  
- **🌐 Web Scraping**: $0.02-0.10 per request
- **🗣️ Text-to-Speech**: $0.05-0.15 per request

### **Hardware Tiers**
- **🌊 Shallow (2-4GB VRAM)**: Basic embeddings, TTS
- **🏊 Mid Ocean (4-8GB VRAM)**: Small LLMs, all basic services
- **🌊 Open Ocean (8-22GB VRAM)**: Medium LLMs, high throughput
- **🌊 Deep Ocean (22GB+ VRAM)**: Large LLMs, premium rates

### **Maximizing Earnings**
- **Uptime**: Keep your provider running 24/7
- **Performance**: Ensure stable internet and optimal hardware
- **Referrals**: Invite others and earn from their activity
- **Updates**: Keep your CLI updated for new features

## 🔧 Commands & Controls

### **Basic Commands**
```bash
# Start the provider
cxmpute-provider

# Stop the provider
# Press Ctrl+C in the terminal
```

### **Status Checks**
- **Green ●**: Provider active and earning
- **Yellow ●**: Provider starting up
- **Red ●**: Provider error or offline

## 🛠️ Troubleshooting

### **Common Issues**

#### **"Command not found: cxmpute-provider"**
- **Cause**: Binary not in PATH or not executable
- **Fix**: Follow the "Install Globally" section above

#### **"Permission denied"**
- **macOS/Linux**: Run `chmod +x cxmpute-provider-*`
- **Windows**: Run as Administrator

#### **"Node start failed: ECONNREFUSED"**
- **Cause**: Network connectivity issue
- **Fix**: Check internet connection, restart the CLI

#### **macOS Security Warning**
1. Go to **System Preferences** > **Security & Privacy** > **General**
2. Click **"Allow Anyway"** for cxmpute-provider
3. Re-run the application

#### **Windows SmartScreen Warning**
1. Click **"More info"**
2. Click **"Run anyway"**
3. The application will start normally

#### **Low Earnings**
- Check your **device tier** - upgrade hardware for better rates
- Ensure **stable internet** connection (100+ Mbps recommended)
- Maximize **uptime** - run 24/7 for consistent earnings
- Check for **software conflicts** (antivirus, firewall)

### **Log Files**
Provider logs are stored in:
- **macOS**: `~/Library/Logs/cxmpute-provider/`
- **Linux**: `~/.local/share/cxmpute-provider/logs/`
- **Windows**: `%APPDATA%\cxmpute-provider\logs\`

## 🔐 Security & Privacy

### **What Data is Collected**
- **Hardware specs**: For service assignment
- **Usage metrics**: For earnings calculation
- **Error logs**: For debugging and support

### **What's NOT Collected**
- **Personal files**: No access to your documents
- **Browsing history**: No tracking of web activity
- **Sensitive data**: No personal information stored

### **Data Protection**
- All communications are **encrypted**
- Provider credentials are **embedded** securely
- No sensitive data is transmitted

## 📞 Support

### **Getting Help**
- **Documentation**: [GitHub Repository](https://github.com/unxversal/cxmpute-core)
- **Issues**: [GitHub Issues](https://github.com/unxversal/cxmpute-core/issues)
- **Email**: support@cxmpute.cloud
- **Community**: [Discord](#) (coming soon)

### **Before Contacting Support**
1. Check this troubleshooting guide
2. Try restarting the CLI
3. Check your internet connection
4. Review log files for error details

## 🚀 Advanced Configuration

### **Environment Variables** (for development)
```bash
# For developers running from source
export CXMPUTE_PROVIDER_SECRET="your-dev-secret"
export CXMPUTE_API_BASE_URL="http://localhost:3000"  # for local testing
```

### **Custom Configuration**
Advanced users can modify provider behavior by editing configuration files (coming soon).

## 📈 Roadmap

### **Coming Soon**
- **📱 Mobile app** for remote monitoring
- **🏆 Provider leaderboards** and achievements
- **🔧 Custom service** configuration
- **💳 Multiple payout** options
- **🌍 Regional optimization** for better performance

---

## 🎉 Ready to Start Earning?

1. **Download** the CLI for your platform
2. **Run** the setup wizard
3. **Keep it running** 24/7
4. **Watch your earnings** grow!

**Questions?** Reach out to support@cxmpute.cloud

---

*Cxmpute - Decentralized AI Compute Network* 