#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status messages
print_status() {
    echo -e "${GREEN}==>${NC} $1"
}

print_error() {
    echo -e "${RED}Error:${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}Warning:${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root (use sudo)"
    exit 1
fi

# Detect OS and architecture
OS=$(uname -s)
ARCH=$(uname -m)
INSTALL_DIR="/usr/local/lib/cxmpute-provider"
BIN_DIR="/usr/local/bin"

print_status "Detected OS: $OS, Architecture: $ARCH"

# Check for Node.js
if ! command -v node &> /dev/null; then
    print_status "Node.js not found. Installing..."
    
    # Add NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    
    # Install Node.js
    if command -v apt-get &> /dev/null; then
        apt-get update
        apt-get install -y nodejs
    elif command -v yum &> /dev/null; then
        yum install -y nodejs
    elif command -v dnf &> /dev/null; then
        dnf install -y nodejs
    else
        print_error "Unsupported package manager. Please install Node.js manually."
        exit 1
    fi
fi

# Verify Node.js installation
NODE_VERSION=$(node -v)
print_status "Node.js version: $NODE_VERSION"

# Create installation directory
print_status "Creating installation directory..."
mkdir -p "$INSTALL_DIR"

# Download and extract the latest release
print_status "Downloading latest release..."
LATEST_RELEASE=$(curl -s https://api.github.com/repos/cxmpute/core/releases/latest | grep "tag_name" | cut -d '"' -f 4)
RELEASE_URL="https://github.com/cxmpute/core/archive/refs/tags/${LATEST_RELEASE}.tar.gz"

curl -L "$RELEASE_URL" -o /tmp/cxmpute-provider.tar.gz
tar -xzf /tmp/cxmpute-provider.tar.gz -C /tmp
mv /tmp/cxmpute-core-*/clis/cxmpute-provider/* "$INSTALL_DIR/"

# Install dependencies and build
print_status "Installing dependencies and building..."
cd "$INSTALL_DIR"
npm install
npm run build

# Create symlink
print_status "Creating symlink..."
ln -sf "$INSTALL_DIR/dist/cli.js" "$BIN_DIR/cxmpute-provider"
chmod +x "$BIN_DIR/cxmpute-provider"

# Cleanup
print_status "Cleaning up..."
rm -rf /tmp/cxmpute-provider.tar.gz /tmp/cxmpute-core-*

print_status "Installation complete! You can now run 'cxmpute-provider' from anywhere."
print_status "To update in the future, run: sudo cxmpute-provider --update"
