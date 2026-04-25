#!/usr/bin/env node
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  initKnowledgeProject,
  KnowledgeProjectAlreadyExistsError,
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
      })
      stdout(`Initialized ${result.root}`)
      return 0
    }
    catch (error) {
      if (error instanceof KnowledgeProjectAlreadyExistsError) {
        stderr(error.message)
        stderr('Remove the existing .knowledge directory or choose another --out-dir.')
        return 1
      }

      throw error
    }
  }

  if (command === undefined || command === '--help' || command === '-h') {
    stdout(`Usage: know <command>

Commands:
  init  Create the .knowledge project structure`)
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
  message: string
}

const initHelp = `Usage: know init [options]

Options:
  --out-dir <path>  Parent directory where .knowledge will be created
  -h, --help        Show this help`

function parseInitArgs(args: string[]): InitParseResult {
  let outDir: string | undefined

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

    return { ok: false, message: `Unknown init option: ${arg}` }
  }

  return { ok: true, outDir, message: '' }
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
