#!/usr/bin/env node
import { realpathSync } from 'node:fs'
import { relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  initKnowledgeProject,
  KnowledgeProjectAlreadyExistsError,
  type InitKnowledgeProjectResult,
} from './init'

export interface CliOptions {
  cwd?: string
  stdout?: (line: string) => void
  stderr?: (line: string) => void
}

export async function runCli(args: string[] = process.argv.slice(2), options: CliOptions = {}) {
  const stdout = options.stdout ?? console.log
  const stderr = options.stderr ?? console.error
  const [command] = args

  if (command === 'init') {
    const initOptions = parseInitArgs(args.slice(1))

    if (!initOptions.ok) {
      stderr(initOptions.message)
      stderr('Run `know init --help` for usage.')
      return 1
    }

    if (initOptions.help) {
      stdout(initHelp)
      return 0
    }

    try {
      const result = await initKnowledgeProject({
        cwd: options.cwd,
        outDir: initOptions.outDir,
        agentFiles: initOptions.agentFiles,
        dryRun: initOptions.dryRun,
      })

      if (initOptions.dryRun) {
        for (const line of formatDryRun(result)) {
          stdout(line)
        }
        return 0
      }

      stdout(`Initialized ${result.root}`)
      return 0
    }
    catch (error) {
      if (error instanceof KnowledgeProjectAlreadyExistsError) {
        stderr(error.message)
        stderr('Remove the existing path or choose another --out-dir.')
        return 1
      }

      throw error
    }
  }

  if (command === undefined || command === '--help' || command === '-h') {
    stdout(`Usage: know <command>

Commands:
  init  Create or update the .knowledge project structure`)
    return 0
  }

  stderr(`Unknown command: ${command}`)
  stderr('Run `know --help` for usage.')
  return 1
}

interface InitParseResult {
  ok: boolean
  help?: boolean
  outDir?: string
  agentFiles?: boolean
  dryRun?: boolean
  message: string
}

const initHelp = `Usage: know init [options]

Options:
  --out-dir <path>  Parent directory where .knowledge will be created
  --agent-files     Create missing agent-specific instruction files
  --no-agent-files  Do not update agent-specific instruction files
  --dry-run         Preview changes without writing files
  -h, --help        Show this help`

function parseInitArgs(args: string[]): InitParseResult {
  let outDir: string | undefined
  let agentFiles: boolean | undefined
  let dryRun = false

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '-h' || arg === '--help') {
      return { ok: true, help: true, message: '' }
    }

    if (arg === '--out-dir') {
      const value = args[index + 1]

      if (value === undefined || value.startsWith('-')) {
        return { ok: false, message: 'Missing value for --out-dir.' }
      }

      outDir = value
      index += 1
      continue
    }

    if (arg.startsWith('--out-dir=')) {
      const value = arg.slice('--out-dir='.length)

      if (value.length === 0) {
        return { ok: false, message: 'Missing value for --out-dir.' }
      }

      outDir = value
      continue
    }

    if (arg === '--agent-files') {
      if (agentFiles === false) {
        return { ok: false, message: 'Cannot combine --agent-files and --no-agent-files.' }
      }

      agentFiles = true
      continue
    }

    if (arg === '--no-agent-files') {
      if (agentFiles === true) {
        return { ok: false, message: 'Cannot combine --agent-files and --no-agent-files.' }
      }

      agentFiles = false
      continue
    }

    if (arg === '--dry-run') {
      dryRun = true
      continue
    }

    return { ok: false, message: `Unknown init option: ${arg}` }
  }

  return { ok: true, outDir, agentFiles, dryRun, message: '' }
}

function formatDryRun(result: InitKnowledgeProjectResult) {
  const create = result.agentInstructions.filter((operation) => operation.action === 'create')
  const update = result.agentInstructions.filter((operation) => operation.action === 'update')
  const unchanged = result.agentInstructions.filter((operation) => operation.action === 'unchanged')
  const skip = result.agentInstructions.filter((operation) => operation.action === 'skip')
  const lines: string[] = []

  addGroup(lines, 'Would create:', result, create)
  addGroup(lines, 'Would update:', result, update)
  addGroup(lines, 'Would leave unchanged:', result, unchanged)
  addGroup(lines, 'Would skip:', result, skip)

  if (lines.length > 0) {
    lines.push('')
  }

  lines.push('No user-authored content would be overwritten.')

  return lines
}

function addGroup(
  lines: string[],
  heading: string,
  result: InitKnowledgeProjectResult,
  operations: InitKnowledgeProjectResult['agentInstructions'],
) {
  if (operations.length === 0) {
    return
  }

  if (lines.length > 0) {
    lines.push('')
  }

  lines.push(heading)

  for (const operation of operations) {
    const displayPath = relative(result.projectRoot, operation.path) || '.'
    const reason = operation.reason === undefined ? '' : ` (${operation.reason})`
    lines.push(`  ${displayPath}${reason}`)
  }
}

if (isEntrypoint()) {
  runCli().then((exitCode) => {
    process.exitCode = exitCode
  }).catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}

function isEntrypoint() {
  const entryPath = process.argv[1]

  if (entryPath === undefined) {
    return false
  }

  try {
    return realpathSync(entryPath) === fileURLToPath(import.meta.url)
  }
  catch {
    return false
  }
}
