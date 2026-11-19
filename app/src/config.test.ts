import { describe, expect, test } from 'bun:test'
import type { Business, Worker } from '@justanarthur/modo-ui-standards'
import { allowRules, businessArgs, onProfile, parseRefusal, toProfiles, workerArgs, workerGaps } from './config'

const business: Business = {
  id: 'northwind',
  name: 'Northwind',
  assets: [
    { id: 'site', kind: 'website', url: 'https://northwind.example' },
    { id: 'repo', kind: 'repo', repo: 'northwind/web' },
  ],
  packs: ['website', 'repo@1'],
  waivers: [],
}

const worker: Worker = {
  id: 'sonnet-fixer',
  runtime: 'claude-code',
  profile: '~/.claude',
  model: 'sonnet',
  effort: 'medium',
  permission_mode: 'acceptEdits',
  allow: ['Bash(git *)'],
}

describe('form to CLI', () => {
  test('business set takes the object after --json, as the form holds it', () => {
    const args = businessArgs(business)
    expect(args.slice(0, 3)).toEqual(['business', 'set', '--json'])
    expect(JSON.parse(args[3]!)).toEqual(business)
  })

  test("an emptied field isn't written as an empty string", () => {
    const args = businessArgs({ ...business, assets: [{ id: 'site', kind: 'website', url: undefined }] })
    expect(args[3]).toBe('{"id":"northwind","name":"Northwind","assets":[{"id":"site","kind":"website"}],"packs":["website","repo@1"],"waivers":[]}')
  })

  test('worker set round-trips the worker', () => {
    const args = workerArgs(worker)
    expect(args.slice(0, 3)).toEqual(['worker', 'set', '--json'])
    expect(JSON.parse(args[3]!)).toEqual(worker)
  })
})

describe('CLI refusal to form', () => {
  test('schema issues land under their fields; a pack index under packs', () => {
    const stderr = [
      'business:',
      '  id: Invalid string: must match pattern /^[a-z0-9-]+$/',
      '  assets.1.repo: Invalid string: must match pattern /^[\\w.-]+\\/[\\w.-]+$/',
      '  packs.0: Invalid string: must match pattern /^[a-z0-9-]+(@\\d+)?$/',
    ].join('\n')
    expect(parseRefusal(stderr, 'business')).toEqual({
      fields: {
        id: 'Invalid string: must match pattern /^[a-z0-9-]+$/',
        'assets.1.repo': 'Invalid string: must match pattern /^[\\w.-]+\\/[\\w.-]+$/',
        packs: 'Invalid string: must match pattern /^[a-z0-9-]+(@\\d+)?$/',
      },
      message: undefined,
    })
  })

  test('a missing pack goes under packs', () => {
    expect(parseRefusal('businesses/northwind: no pack seo', 'business').fields).toEqual({ packs: 'There is no pack seo.' })
  })

  test("what the form has no field for stays a message: no assets, a worker in use", () => {
    expect(parseRefusal('business:\n  assets: Too small: expected array to have >=1 items', 'business')).toEqual({
      fields: {},
      message: 'assets: Too small: expected array to have >=1 items',
    })
    expect(parseRefusal('modo uses worker sonnet-fixer as its default', 'worker')).toEqual({
      fields: {},
      message: 'modo uses worker sonnet-fixer as its default',
    })
  })

  test('a worker keeps the index of the allow rule', () => {
    expect(parseRefusal('worker:\n  allow.2: Invalid input', 'worker').fields).toEqual({ 'allow.2': 'Invalid input' })
  })

  test('a worker needs an id without spaces and a model', () => {
    expect(workerGaps(worker).fields).toEqual({})
    expect(workerGaps({ ...worker, id: ' ', model: '' }).fields).toEqual({ id: 'Give the worker an id.', model: 'Pick a model.' })
    expect(workerGaps({ ...worker, id: 'my fixer' }).fields).toEqual({ id: 'An id has no spaces.' })
  })
})

test('Always allow keeps each suggested rule; a mode change is no rule', () => {
  const rules = allowRules([
    { type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'python3 -' }, { toolName: 'WebFetch' }] },
    { type: 'setMode' },
  ])
  expect(rules).toEqual(['Bash(python3 -)', 'WebFetch'])
  expect(allowRules([{ type: 'setMode' }])).toEqual([])
})

test('profiles show with ~, named by their dir', () => {
  const profiles = toProfiles(
    [
      { configDir: '/Users/you/.claude', signedIn: true, email: 'you@example.com' },
      { configDir: '/Users/you/.claude-work', signedIn: false },
      { configDir: '/Users/you/.claude-glm', signedIn: false, baseUrl: 'https://api.example' },
    ],
    '/Users/you',
  )
  expect(profiles).toEqual([
    { configDir: '~/.claude', label: 'default', signedIn: true, account: 'you@example.com' },
    { configDir: '~/.claude-work', label: 'work', signedIn: false, account: undefined },
    { configDir: '~/.claude-glm', label: 'glm', signedIn: true, account: 'API key' },
  ])
})

test('the profile picked moves only the presets still on another one', () => {
  const custom = { ...worker, id: 'mine' }
  const workers = [worker, { ...worker, id: 'opus-fixer', profile: '~/.claude-work' }, custom]
  expect(onProfile(workers, '~/.claude-work')).toEqual([{ ...worker, profile: '~/.claude-work' }])
})
