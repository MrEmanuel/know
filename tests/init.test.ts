import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, test } from 'vitest'
import { initKnowledgeProject } from '../src'
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

  test('can be run again without clobbering existing ignore rules', async () => {
    const cwd = await makeWorkspace()
    const knowledgeRoot = join(cwd, '.knowledge')

    await mkdir(knowledgeRoot)
    await writeFile(join(knowledgeRoot, '.gitignore'), 'custom-rule\n')
    await initKnowledgeProject({ cwd })
    await initKnowledgeProject({ cwd })

    const gitignore = await readFile(join(cwd, '.knowledge', '.gitignore'), 'utf8')

    expect(gitignore).toContain('custom-rule')
    expect(gitignore.match(/^indexes\/$/gm)).toHaveLength(1)
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
    expect(stdout.join('\n')).toContain('Initialized .knowledge')
  })
})
