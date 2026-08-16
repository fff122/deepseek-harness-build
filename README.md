# deepseek-harness-build

Standalone executable builds for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

## Supported targets

| Platform | Architecture |
|----------|-------------|
| Windows  | x64         |
| Windows  | arm64       |
| Linux    | x64         |
| Linux    | arm64       |

## Build locally

pnpm install

pnpm exec tsx scripts/build-exe-cli.ts --targets=node24-linux-x64
