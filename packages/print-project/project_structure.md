```
solenoid-labs
├── packages
│   ├── api
│   │   └── README.md
│   ├── core
│   │   ├── package.json
│   │   └── README.md
│   ├── server
│   │   └── README.md
│   └── web
│       ├── package.json
│       └── README.md
├── pyproject.toml
└── turbo.json
```

---

## File Contents

### `pyproject.toml`
```toml
# pyproject.toml

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.ruff]
target-version = "py311"
line-length = 150
select = [
    "E",    # pycodestyle errors
    "W",    # pycodestyle warnings
    "F",    # pyflakes
    "I",    # isort
    "C",    # flake8-comprehensions
    "B",    # flake8-bugbear
    "UP",   # pyupgrade
]
ignore = [
    "E501",
]

[tool.ruff.isort]
known-third-party = []
section-order = ["future", "standard-library", "third-party", "first-party", "local-folder"]

[tool.mypy]
python_version = "3.11"
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true
disallow_incomplete_defs = true

```

### `turbo.json`
```json
{
    "$schema": "https://turbo.build/schema.json",
    "globalDependencies": [
      "tsconfig.base.json",
      "pnpm-lock.yaml"
    ],
    "tasks": {
      "build": {
        "dependsOn": ["^build"],
        "outputs": [
          "dist/**",
          ".next/**",
          "build/**",
          "public/build/**",
          "lib/**",
          "!.next/cache/**"
        ]
      },
      "lint": {
        "outputs": []
      },
      "test": {
        "dependsOn": ["^build"],
        "outputs": ["coverage/**", "junit.xml"]
      },
      "dev": {
        "cache": false,
        "persistent": true
      },
      "clean": {
        "cache": false
      }
    }
  }
```