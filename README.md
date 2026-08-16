# deepseek-harness-build

Standalone executable builds for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

## Supported targets

| Platform | Architecture |
|----------|-------------|
| Windows  | x64         |
| Windows  | arm64       |
| Linux    | x64         |
| Linux    | arm64       |

## Quick Start

### 1. Enable GitHub Actions

Go to the [Actions tab](https://github.com/fff122/deepseek-harness-build/actions) and click **New workflow** -> **set up a workflow yourself**.
Copy the content of [workflow.yml](workflow.yml) into the editor and commit it as .github/workflows/build-exe-cli.yml.

### 2. Build

The workflow runs on: 
- Every push of a * tag (e.g. 1.0.0)
- Manual trigger via **Actions** tab -> **Build CLI executables** -> **Run workflow**

### 3. Download

Artifacts are available in the workflow run page. Tagged releases automatically create a GitHub Release with all executables.

## Build locally

pnpm install

pnpm exec tsx scripts/build-exe-cli.ts --targets=node24-linux-x64
