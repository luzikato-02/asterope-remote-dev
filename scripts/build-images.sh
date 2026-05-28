#!/bin/bash
# Build all Asterope Docker images
# Run from the project root: bash scripts/build-images.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DOCKER_DIR="$PROJECT_DIR/docker"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

info()    { echo -e "${YELLOW}[BUILD]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

command -v docker &>/dev/null || error "Docker is not installed"

# Build order matters — base must be first, then images that depend on it
declare -a IMAGES=(
  "base"
  "node"
  "python"
  "php"
  "laravel"
  "go"
  "fullstack"
)

echo ""
info "Building Asterope Docker images..."
echo ""

for name in "${IMAGES[@]}"; do
  dockerfile="$DOCKER_DIR/Dockerfile.${name}"

  if [[ ! -f "$dockerfile" ]]; then
    echo "  Skipping $name (no Dockerfile found)"
    continue
  fi

  info "Building asterope/${name}:latest ..."
  if docker build \
    --file "$dockerfile" \
    --tag "asterope/${name}:latest" \
    --build-arg BUILDKIT_INLINE_CACHE=1 \
    "$PROJECT_DIR" \
    2>&1 | sed 's/^/    /'; then
    success "asterope/${name}:latest built"
  else
    error "Failed to build asterope/${name}"
  fi
  echo ""
done

echo ""
echo -e "${GREEN}All images built successfully!${NC}"
echo ""
echo "Installed images:"
docker images --filter "reference=asterope/*" --format "  {{.Repository}}:{{.Tag}}\t{{.Size}}"
echo ""
