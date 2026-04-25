import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, test } from 'vitest'
import {
  initKnowledgeProject,
  KnowledgeProjectAlreadyExistsError,
} from '../src'
import { runCli } from '../src/cli'

async function makeWorkspace() {
  return mkdtemp(join(tmpdir(), 'know-init-'))
}

async function pathExists(path: string) {
  try {
    await stat(path)
    return true
  }
  catch {
    return false
  }
}

async function expectDirectory(path: string) {
  const stats = await stat(path)

  expect(stats.isDirectory()).toBe(true)
}

describe('initKnowledgeProject', () => {
  test('creates the knowledge source tree and keeps generated indexes out of git', async () => {
    const cwd = await makeWorkspace()

    await initKnowledgeProject({ cwd })

    await expectDirectory(join(cwd, '.knowledge', 'concepts'))
    await expectDirectory(join(cwd, '.knowledge', 'rules'))
    await expectDirectory(join(cwd, '.knowledge', 'decisions'))
    await expectDirectory(join(cwd, '.knowledge', 'evidence'))
    await expectDirectory(join(cwd, '.knowledge', 'sources'))
    await expectDirectory(join(cwd, '.knowledge', 'indexes'))
    await expectDirectory(join(cwd, '.knowledge', 'schemas'))

    await expect(pathExists(join(cwd, '.knowledge', 'indexes', 'knowledge.sqlite'))).resolves.toBe(false)
    await expect(readFile(join(cwd, '.knowledge', '.gitignore'), 'utf8')).resolves.toContain('indexes/')
  })

  test('creates the knowledge source tree in a requested output directory', async () => {
    const cwd = await makeWorkspace()

    await initKnowledgeProject({ cwd, outDir: 'generated' })

    await expectDirectory(join(cwd, 'generated', '.knowledge', 'concepts'))
    await expectDirectory(join(cwd, 'generated', '.knowledge', 'rules'))
    await expect(pathExists(join(cwd, '.knowledge'))).resolves.toBe(false)
  })

  test('accepts an output path that already ends in .knowledge', async () => {
    const cwd = await makeWorkspace()

    await initKnowledgeProject({ cwd, outDir: join('generated', '.knowledge') })

    await expectDirectory(join(cwd, 'generated', '.knowledge', 'concepts'))
    await expect(pathExists(join(cwd, 'generated', '.knowledge', '.knowledge'))).resolves.toBe(false)
  })

  test('fails instead of clobbering an existing knowledge project', async () => {
    const cwd = await makeWorkspace()
    const knowledgeRoot = join(cwd, '.knowledge')

    await mkdir(knowledgeRoot)
    await writeFile(join(knowledgeRoot, '.gitignore'), 'custom-rule\n')

    await expect(initKnowledgeProject({ cwd })).rejects.toBeInstanceOf(KnowledgeProjectAlreadyExistsError)
    await expect(readFile(join(cwd, '.knowledge', '.gitignore'), 'utf8')).resolves.toBe('custom-rule\n')
  })
})

describe('know init', () => {
  test('initializes the current working directory', async () => {
    const cwd = await makeWorkspace()
    const stdout: string[] = []

    await expect(runCli(['init'], {
      cwd,
      stdout: (line) => stdout.push(line),
      stderr: () => undefined,
    })).resolves.toBe(0)

    await expectDirectory(join(cwd, '.knowledge', 'concepts'))
    expect(stdout.join('\n')).toContain(join(cwd, '.knowledge'))
  })

  test('initializes a requested output directory', async () => {
    const cwd = await makeWorkspace()

    await expect(runCli(['init', '--out-dir', 'generated'], {
      cwd,
      stdout: () => undefined,
      stderr: () => undefined,
    })).resolves.toBe(0)

    await expectDirectory(join(cwd, 'generated', '.knowledge', 'concepts'))
  })

  test('reports an existing knowledge project without overwriting it', async () => {
    const cwd = await makeWorkspace()
    const stderr: string[] = []

    await initKnowledgeProject({ cwd })

    await expect(runCli(['init'], {
      cwd,
      stdout: () => undefined,
      stderr: (line) => stderr.push(line),
    })).resolves.toBe(1)

    expect(stderr.join('\n')).toContain('Overwrite, remove, and fix modes are not implemented yet')
    expect(stderr.join('\n')).toContain('choose another --out-dir')
  })
})
