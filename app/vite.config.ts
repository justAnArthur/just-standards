import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAppViteConfig } from '@just-apps/vite'

const kits = ['@justanarthur/modo-ui-standards', '@justanarthur/modo-ui-ai'].map(kit =>
  dirname(fileURLToPath(import.meta.resolve(`${kit}/package.json`))),
)

export default createAppViteConfig({
  root: import.meta.dirname,
  uno: {
    content: {
      filesystem: kits.map(kit => `${kit}/dist/**/*.js`),
      // The platform's pipeline reads only .ts, .tsx and .html: without this the kits' built files are skipped.
      pipeline: { include: [/\.(tsx?|html)($|\?)/, /modo-ui-(standards|ai)\/dist\/.*\.js$/] },
    },
  },
})
