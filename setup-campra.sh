#!/bin/bash
# Setup script for Campra blue-green deployment
# Run this once on your server to prepare for zero-downtime deployments.

echo "🔧 Setting up Campra for blue-green deployments..."

# Define directories
BLUE_DIR="/home/almalinux/Campra-blue"
GREEN_DIR="/home/almalinux/Campra-green" # Will be created by the first deployment
CURRENT_LINK="/home/almalinux/Campra-current"
ORIGINAL_DIR="/home/almalinux/Campra"

# --- Pre-flight Checks ---
# 1. Ensure the original Campra installation exists
if [ ! -d "$ORIGINAL_DIR" ]; then
    echo "❌ Original Campra installation not found at $ORIGINAL_DIR. Please ensure it is installed."
    exit 1
fi

# 2. Ensure the config file exists
if [ ! -f "$ORIGINAL_DIR/.config/default.yml" ]; then
    echo "❌ Configuration file not found at $ORIGINAL_DIR/.config/default.yml. Please ensure it is configured."
    exit 1
fi

# 3. Stop and disable the old systemd service to prevent conflicts
if sudo systemctl is-active --quiet campra; then
    echo "🛑 Stopping and disabling existing systemd service for Campra..."
    sudo systemctl stop campra
    sudo systemctl disable campra
    echo "✅ Service stopped and disabled."
fi

# --- Environment Setup ---
# Create the "blue" environment from the original installation
echo "📂 Creating blue environment from original installation..."
if [ -d "$BLUE_DIR" ]; then
    rm -rf "$BLUE_DIR"
fi
cp -r "$ORIGINAL_DIR" "$BLUE_DIR"

# Create the initial symlink pointing to blue. This is for reference.
echo "🔗 Creating 'current' symlink to point to the blue environment..."
ln -sfn "$BLUE_DIR" "$CURRENT_LINK"

# Backup original nginx config
if [ -f "/etc/nginx/sites-available/campra" ]; then
    echo "💾 Backing up existing nginx configuration to /etc/nginx/sites-available/campra.backup..."
    sudo cp /etc/nginx/sites-available/campra /etc/nginx/sites-available/campra.backup
else
    echo "⚠️ Nginx config not found at /etc/nginx/sites-available/campra. Skipping backup."
fi

echo "✅ Blue-green environment setup is complete!"
echo ""
echo "📋 Summary:"
echo "• The existing 'campra' systemd service has been stopped and disabled."
echo "• The 'blue' environment has been created at $BLUE_DIR."
echo "• A symlink '$CURRENT_LINK' now points to the blue directory."
echo ""
echo "🚀 You are now ready for your first zero-downtime deployment via GitHub Actions."
echo "   The first deployment will start the application on port 4000 and configure Nginx."
