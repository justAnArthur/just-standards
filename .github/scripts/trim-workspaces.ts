// Only this app is checked out: the other apps are empty submodule folders, which neither bun nor cargo can load.
import { existsSync } from 'node:fs'

const manifest = await Bun.file('package.json').json()
manifest.workspaces = manifest.workspaces.filter((w: string) => w.includes('*') || existsSync(`${w}/package.json`))
await Bun.write('package.json', JSON.stringify(manifest, null, 2))

const cargo = await Bun.file('Cargo.toml').text()
const members = [...(cargo.match(/members = \[([^\]]*)\]/)?.[1] ?? '').matchAll(/"([^"]+)"/g)].map(m => m[1] as string)
const kept = members.filter(m => [...new Bun.Glob(`${m}/Cargo.toml`).scanSync('.')].length > 0)
await Bun.write('Cargo.toml', cargo.replace(/members = \[[^\]]*\]/, `members = [${kept.map(m => JSON.stringify(m)).join(', ')}]`))
console.log(`workspaces: ${manifest.workspaces.join(', ')}; cargo members: ${kept.join(', ')}`)
