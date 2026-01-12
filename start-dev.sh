#!/bin/bash
# This script starts a development environment for Campra V4

# Make sure we're in the right directory
cd "$(dirname "$0")" || exit 1

# Create necessary directories if they don't exist
mkdir -p db redis files

# Copy development configuration if it doesn't exist
if [ ! -f .config/default.yml ]; then
  echo "Copying development configuration..."
  cp .config/development.yml .config/default.yml
fi

# Build the development Docker image
echo "Building Docker image for development..."
docker build -t campra-v4-dev .

# Start the development environment
echo "Starting development environment..."
docker-compose -f docker-compose.dev.yml up -d db redis
sleep 5

# Run migrations separately
echo "Running database migrations..."
docker run --rm --name campra_migrate --network campra-v4_campra \
  -v "$(pwd)/files:/campra/files" \
  -v "$(pwd)/.config:/campra/.config:ro" \
  campra-v4-dev pnpm run migrate

# Start the development server
echo "Starting development server..."
docker-compose -f docker-compose.dev.yml up -d web

echo "Campra V4 development environment is now running at http://localhost:3000"
echo "Use 'docker-compose -f docker-compose.dev.yml logs -f web' to see logs"
