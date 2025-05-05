#!/usr/bin/env bash

# setup.sh

set -e

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
  echo "pnpm is not installed. Please install it first:"
  echo "npm install -g pnpm"
  exit 1
fi

# Install dependencies
echo "Installing dependencies..."
pnpm install --frozen-lockfile

# Check if turbo is accessible
if ! npx turbo --version &> /dev/null; then
  echo "Adding turbo as a development dependency..."
  pnpm add -D turbo
fi

# Setup Python environments if needed
if command -v poetry &> /dev/null; then
  echo "Setting up Python environments..."
  for dir in ./packages/*/; do
    if [ -f "${dir}pyproject.toml" ]; then
      echo "Setting up ${dir}..."
      (cd "${dir}" && poetry install --no-root --sync)
    fi
  done
else
  echo "Poetry not found. Python dependencies will not be installed."
  echo "To install Poetry, follow instructions at https://python-poetry.org/docs/#installation"
fi

echo "Setup complete! You can now run:"
echo "  pnpm build - to build all packages"
echo "  pnpm dev - to start development servers"