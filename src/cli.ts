#!/usr/bin/env node
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { initKnowledgeProject } from './init'

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
    await initKnowledgeProject({ cwd: options.cwd })
    stdout('Initialized .knowledge')
    return 0
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
