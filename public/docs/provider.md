# Provider Guide

Transform your computer into an AI compute provider and start earning rewards! This guide will walk you through becoming part of the Cxmpute network.

## What is a Cxmpute Provider?

Cxmpute provides inference and related services powered by a global network of nodes run by providers. [Learn more about using Cxmpute services →](/docs/user)

A **provider** is someone who runs a Cxmpute node on their computer. This node is essentially an inference server connected to our main orchestrator, so requests are routed to your node for inference and completion, and you are rewarded proportionally.

## Hardware Tiers

We categorize devices into different tiers based on their capabilities. **We need devices of all tiers**, but we highly recommend becoming a provider if you have at least **16GB RAM and 30GB free disc space**.

### Device Tiers

| Tier | Name | VRAM | Capabilities | Example Earnings |
|------|------|------|--------------|------------------|
| **Tier 0** | Basic | <1GB | Lightweight tasks, TTS | $5-15/month |
| **Tier 1** | Tide Pool | 1-4GB | Small embeddings, basic TTS | $15-40/month |
| **Tier 2** | Blue Surf | 4-8GB | Small LLMs, all services | $40-100/month |
| **Tier 3** | Open Ocean | 8-22GB | Medium LLMs, high throughput | $100-300/month |
| **Tier 4** | Mariana Depth | 22GB+ | Large LLMs, premium rates | $300-800/month |

*Earnings are estimates based on 24/7 operation and network demand. Actual earnings may vary.*

### System Requirements

#### Minimum Requirements
- **OS**: macOS 10.15+, Linux (Ubuntu 18.04+), Windows 10+
- **RAM**: 4GB+ (8GB+ recommended for LLM services)
- **Storage**: 10GB+ free space
- **Internet**: Stable broadband connection

#### Optimal Requirements
- **GPU**: NVIDIA GPU with 8GB+ VRAM (for LLM hosting)
- **RAM**: 16GB+ (32GB+ for large models)
- **CPU**: Multi-core processor (Intel i5/AMD Ryzen 5+)
- **Internet**: High-speed connection (100+ Mbps)

## Getting Started

### Step 1: Create an Account

Create an account in the [Cxmpute Dashboard](https://cxmpute.cloud/dashboard).

### Step 2: Download the Provider CLI

Download the Cxmpute Provider CLI from our releases:
👉 **[Download Latest Release](https://github.com/unxversal/cxmpute-core/releases)**

#### Choose Your Platform

**🍎 macOS**
- Intel Macs (x64): `cxmpute-provider-macos` or `cxmpute-provider-macos-intel`
- Apple Silicon (M1/M2/M3/M4): `cxmpute-provider-macos-arm64` or `cxmpute-provider-macos-m1`

**🐧 Linux**
- x64: `cxmpute-provider-linux`

**🪟 Windows**
- x64: `cxmpute-provider.exe` or `cxmpute-provider-windows.exe`

### Step 3: Install and Setup

#### Make Executable (macOS/Linux)

```bash
# Navigate to your Downloads folder
cd ~/Downloads

# Make the file executable
chmod +x cxmpute-provider-macos    # or cxmpute-provider-linux
```

#### Run the Provider

**🍎 macOS**
```bash
# Run directly
./cxmpute-provider-macos

# First time? macOS might show security warning:
# Go to System Preferences > Security & Privacy > General
# Click "Allow Anyway" for cxmpute-provider-macos
```

**🐧 Linux**
```bash
# Run directly
./cxmpute-provider-linux
```

**🪟 Windows**
```bash
# Run directly (double-click or command line)
cxmpute-provider.exe

# First time? Windows might show SmartScreen warning:
# Click "More info" > "Run anyway"
```

### Step 4: Follow the Setup Wizard

When you run `cxmpute-provider` for the first time, you'll see:

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

### Step 5: Start Earning!

After setup, you'll see your **provider dashboard**:

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

**🎉 Congratulations!** Your node is running and earning rewards.

## Maximizing Your Earnings

### 💰 Earning Rewards

#### Service Types & Earnings

- **🤖 LLM Inference**: $0.10-0.50 per 1K tokens (varies by model)
- **🔍 Embeddings**: $0.01-0.05 per 1K tokens
- **🌐 Web Scraping**: $0.02-0.10 per request
- **🗣️ Text-to-Speech**: $0.05-0.15 per request

#### Best Practices

1. **⏰ Uptime**: Keep your provider running 24/7 for maximum earnings
2. **🚀 Performance**: Ensure stable internet and optimal hardware
3. **👥 Referrals**: Invite others and earn from their activity ([learn more](/docs/rewards))
4. **🔄 Updates**: Keep your CLI updated for new features
5. **🔧 Optimization**: Run when you're not using your computer to maximize resources

### When to Run Your Node

**💡 Recommended**: Run your node when you're not using your computer, as it tries to use most of your computing power to maximize earnings.

- **🌙 Overnight**: Perfect time for maximum resource allocation
- **📅 Weekends**: Extended periods of high earning potential
- **🎯 Scheduled**: Set up automated schedules for consistent operation

## How Providers Earn

### Points System

Providers earn **points** based on:
- **Usage**: Requests processed and tokens generated
- **Quality**: Response time and reliability
- **Referrals**: People you invite who become active users or providers

### Revenue Distribution

At the end of each **epoch** (usually a month), revenue is distributed proportionally based on points accumulated:

1. Platform collects revenue from users
2. Points are tallied for all providers
3. Revenue is distributed based on each provider's share of total points
4. Payments are processed automatically

### Earning More Points

- **📈 High Uptime**: Consistent availability increases point multiplier
- **⚡ Fast Response**: Better performance = more requests routed to you
- **🎯 Referrals**: Earn bonus points from referred users' activity
- **🔧 Better Hardware**: Higher tiers get priority for premium requests

## Service Types

Your node will automatically provide services based on your hardware capabilities:

### 🤖 LLM Inference (`/chat/completions`)
- **Requirements**: 4GB+ VRAM recommended
- **Models**: Various sizes from 7B to 70B+ parameters
- **Earnings**: Highest earning potential

### 🔍 Embeddings (`/embeddings`)
- **Requirements**: 2GB+ VRAM
- **Models**: Specialized embedding models
- **Earnings**: Consistent, moderate volume

### 🗣️ Text-to-Speech (`/tts`)
- **Requirements**: 1GB+ VRAM or good CPU
- **Models**: Voice synthesis models
- **Earnings**: Steady demand

### 🌐 Web Scraping (`/scrape`)
- **Requirements**: Good internet connection
- **Function**: Content extraction and processing
- **Earnings**: Per-request based

## Troubleshooting

### Common Issues

#### "Command not found: cxmpute-provider"
- **Cause**: Binary not in PATH or not executable
- **Fix**: Follow the installation steps above, ensure file is executable

#### "Permission denied"
- **macOS/Linux**: Run `chmod +x cxmpute-provider-*`
- **Windows**: Run as Administrator

#### "Node start failed: ECONNREFUSED"
- **Cause**: Network connectivity issue
- **Fix**: Check internet connection, restart the CLI

#### macOS Security Warning
1. Go to **System Preferences** > **Security & Privacy** > **General**
2. Click **"Allow Anyway"** for cxmpute-provider
3. Re-run the application

#### Windows SmartScreen Warning
1. Click **"More info"**
2. Click **"Run anyway"**
3. The application will start normally

#### Low Earnings
- Check your device tier - upgrade hardware for better rates
- Ensure stable internet connection (100+ Mbps recommended)
- Maximize uptime - run 24/7 for consistent earnings
- Check for software conflicts (antivirus, firewall)

### Log Files

Provider logs are stored in:
- **macOS**: `~/Library/Logs/cxmpute-provider/`
- **Linux**: `~/.local/share/cxmpute-provider/logs/`
- **Windows**: `%APPDATA%\cxmpute-provider\logs\`

### Status Indicators

- **Green ●**: Provider active and earning
- **Yellow ●**: Provider starting up
- **Red ●**: Provider error or offline

## Security & Privacy

### What Data is Collected
- **Hardware specs**: For service assignment
- **Usage metrics**: For earnings calculation
- **Error logs**: For debugging and support

### What's NOT Collected
- **Personal files**: No access to your documents
- **Browsing history**: No tracking of web activity
- **Sensitive data**: No personal information stored

### Data Protection
- All communications are encrypted
- Provider credentials are embedded securely
- No sensitive data is transmitted

## Install Globally (Optional)

Make `cxmpute-provider` available from anywhere on your system:

**🍎 macOS**
```bash
# Install globally
sudo mv ~/Downloads/cxmpute-provider-macos /usr/local/bin/cxmpute-provider

# Now run from anywhere
cxmpute-provider
```

**🐧 Linux**
```bash
# Install globally
sudo mv ~/Downloads/cxmpute-provider-linux /usr/local/bin/cxmpute-provider

# Now run from anywhere
cxmpute-provider
```

**🪟 Windows**

*Option 1: System32 (requires admin)*
```cmd
# Open Command Prompt as Administrator
move "%USERPROFILE%\Downloads\cxmpute-provider.exe" "C:\Windows\System32\cxmpute-provider.exe"

# Now run from anywhere
cxmpute-provider
```

*Option 2: Add to PATH*
1. Create folder: `C:\cxmpute\`
2. Move `cxmpute-provider.exe` to `C:\cxmpute\`
3. Add `C:\cxmpute\` to your PATH environment variable
4. Restart Command Prompt/PowerShell
5. Run: `cxmpute-provider`

## Commands & Controls

### Basic Commands
```bash
# Start the provider
cxmpute-provider

# Stop the provider
# Press Ctrl+C in the terminal
```

### Advanced Usage
- The CLI handles all complex operations automatically
- No manual configuration required
- Updates are handled through new releases

## Support

### Getting Help
- **Discord**: Join our [community](https://discord.com/invite/CJGA7B2zKT) for real-time support
- **GitHub**: Report issues on our [repository](https://github.com/unxversal/cxmpute-core)
- **Email**: Contact support@cxmpute.cloud

### Community
Join our Discord for:
- Latest news and updates
- Provider tips and tricks
- Community support
- Feature announcements

## Next Steps

1. **📊 Monitor Earnings**: Keep track of your progress in the dashboard
2. **👥 Invite Friends**: Use the [referral system](/docs/rewards) to boost earnings
3. **⬆️ Upgrade Hardware**: Consider hardware improvements for higher tiers
4. **🌍 Join Community**: Connect with other providers on Discord

---

**Ready to start earning?** [Download the CLI](https://github.com/unxversal/cxmpute-core/releases) and join thousands of providers powering the Cxmpute network! 