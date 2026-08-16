/**
 * Build dsh CLI standalone executables via @yao-pkg/pkg --sea.
 * Targets: node24-linux-x64, node24-linux-arm64, node24-win-x64, node24-win-arm64.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

const root = resolve(import.meta.dirname, '..')
const DEPLOY_PACKAGE = '@deepseek-ai/dsh'
const ENTRY_BIN = 'lib/bin.js'
const OUTPUT_BASENAME = 'dsh'
const DEFAULT_NODE_RANGE = 'node24'
const PKG_SPEC = '@yao-pkg/pkg@6.21.0'
const OUT_DIR = 'dist-exe'

const PLATFORMS = ['linux', 'win'] as const
const ARCHES = ['x64', 'arm64'] as const
type Platform = (typeof PLATFORMS)[number]
type Arch = (typeof ARCHES)[number]

class Target {
  constructor(
    readonly nodeRange: string,
    readonly platform: Platform,
    readonly arch: Arch,
  ) {}
  get spec(): string { return `${this.nodeRange}-${this.platform}-${this.arch}` }
  get exeName(): string {
    const ext = this.platform === 'win' ? '.exe' : ''
    return `${OUTPUT_BASENAME}-${this.platform}-${this.arch}${ext}`
  }
  static parse(spec: string): Target {
    const parts = spec.split('-')
    if (parts.length !== 3) throw new Error(`Invalid target: ${spec}`)
    const [nr, p, a] = parts as [string, string, string]
    if (!PLATFORMS.includes(p as Platform)) throw new Error(`Unknown platform: ${p}`)
    if (!ARCHES.includes(a as Arch)) throw new Error(`Unknown arch: ${a}`)
    return new Target(nr, p as Platform, a as Arch)
  }
  static host(): Target {
    const p = process.platform === 'linux' ? 'linux' : process.platform === 'win32' ? 'win' : undefined
    if (!p) throw new Error(`Unsupported host: ${process.platform}`)
    const a = process.arch === 'x64' || process.arch === 'arm64' ? process.arch : undefined
    if (!a) throw new Error(`Unsupported arch: ${process.arch}`)
    return new Target(DEFAULT_NODE_RANGE, p, a)
  }
}

function pnpmBin(): string { return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm' }

async function run(step: string, cmd: string, args: string[]): Promise<void> {
  console.log(`[${step}] ${cmd} ${args.join(' ')}`)
  const child = spawn(cmd, args, { stdio: 'inherit', cwd: root })
  await new Promise<void>((resolve, reject) => {
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${step} exited with ${code}`)))
  })
}

class CliExeBuild {
  staging = resolve(root, 'dist-staging-cli')
  private outDir = resolve(root, OUT_DIR)

  constructor(private targets: Target[]) {}

  async build(): Promise<void> {
    await run('build', pnpmBin(), ['run', 'build'])
  }

  async deployStaging(): Promise<void> {
    await rm(this.staging, { recursive: true, force: true })
    await run('deploy', pnpmBin(), [
      '--filter', DEPLOY_PACKAGE, 'deploy', '--legacy', '--prod',
      '--config.node-linker=hoisted',
      '--config.auto-install-peers=false',
      this.staging,
    ])
  }

  async injectPkgConfig(): Promise<void> {
    const manifestPath = join(this.staging, 'package.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    manifest.bin = ENTRY_BIN
    manifest.pkg = { assets: ['package.json', 'node_modules/**/*.js', 'node_modules/**/*.cjs', 'node_modules/**/*.mjs', 'node_modules/**/package.json', 'node_modules/**/*.json', 'node_modules/**/*.node'] }
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
  }

  async pack(target: Target): Promise<string> {
    await mkdir(this.outDir, { recursive: true })
    await run(`pkg ${target.spec}`, pnpmBin(), [
      'exec', '--package', PKG_SPEC, '--',
      'pkg', this.staging,
      '--targets', target.spec,
      '--output', join(this.outDir, target.exeName),
      '--sea',
      '--compress', 'brotli',
    ])
    return join(this.outDir, target.exeName)
  }
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      targets: { type: 'string' },
      help: { type: 'boolean', default: false },
    },
  })
  if (values.help) {
    console.log('Usage: pnpm exec tsx scripts/build-exe-cli.ts --targets=node24-linux-x64,node24-win-x64,...')
    process.exit(0)
  }
  const targets = values.targets
    ? values.targets.split(',').map(s => Target.parse(s.trim())).filter(Boolean)
    : [Target.host()]
  if (targets.length === 0) { console.error('No targets specified'); process.exit(1) }

  const builder = new CliExeBuild(targets)
  await builder.build()
  await builder.deployStaging()
  await builder.injectPkgConfig()

  for (const target of targets) {
    const exe = await builder.pack(target)
    console.log(`Built: ${exe}`)
  }
  console.log('Done.')
}

main().catch(err => { console.error(err); process.exit(1) })