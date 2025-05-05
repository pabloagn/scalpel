.PHONY: help install dev build test lint clean docker-up docker-down format create-package

# Display help information
help:
	@echo "Solenoid Labs Monorepo Management Commands"
	@echo ""
	@echo "Usage:"
	@echo "  make install         Install all dependencies"
	@echo "  make dev             Start development servers"
	@echo "  make build           Build all packages"
	@echo "  make test            Run tests"
	@echo "  make lint            Run linters"
	@echo "  make format          Format code"
	@echo "  make clean           Clean build artifacts"
	@echo "  make docker-up       Start Docker services"
	@echo "  make docker-down     Stop Docker services"
	@echo "  make create-package  Create a new package"
	@echo ""

# Install dependencies
install:
	pnpm install

# Start development server
dev:
	pnpm dev

# Build all packages
build:
	pnpm build

# Run tests
test:
	pnpm test

# Run linters
lint:
	pnpm lint

# Format code
format:
	pnpm format

# Clean build artifacts
clean:
	pnpm clean

# Start Docker services
docker-up:
	docker-compose up -d

# Stop Docker services
docker-down:
	docker-compose down

# Create a new package
create-package:
	@read -p "Package name (e.g., phantom-new-package): " package_name; \
	mkdir -p packages/$$package_name/src; \
	echo "# $$package_name\n\n<div align=\"center\">\n\n*A component of the Phantom ecosystem.*\n\n</div>\n\n<br/>\n<div align=\"center\">───────  §  ───────</div>\n<br/>\n\n## Overview\n\nA brief description of the $$package_name component.\n\n## Getting Started\n\n\`\`\`bash\n# Install dependencies\npnpm install\n\n# Run development server\npnpm dev\n\n# Build for production\npnpm build\n\`\`\`\n\n## Documentation\n\nFor full documentation, see the [docs directory](../../docs/packages/$$package_name/).\n\n## License\n\n[MIT](./LICENSE)" > packages/$$package_name/README.md; \
	mkdir -p docs/packages/$$package_name; \
	echo "{\n  \"name\": \"$$package_name\",\n  \"version\": \"0.1.0\",\n  \"private\": true,\n  \"scripts\": {\n    \"dev\": \"echo 'Add dev script here',\n    \"build\": \"echo 'Add build script here',\n    \"test\": \"echo 'Add test script here',\n    \"lint\": \"echo 'Add lint script here',\n    \"clean\": \"echo 'Add clean script here'\n  }\n}" > packages/$$package_name/package.json; \
	echo "# $$package_name Documentation\n\n<div align=\"center\">\n\n*Documentation for the $$package_name component.*\n\n</div>\n\n<br/>\n<div align=\"center\">───────  §  ───────</div>\n<br/>\n\n## Overview\n\nOverview of the $$package_name component.\n\n## Table of Contents\n\n- [Getting Started](./getting-started.md)\n- [API Reference](./api-reference.md)\n- [Contributing](./contributing.md)" > docs/packages/$$package_name/README.md;
