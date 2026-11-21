import { afterAll, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { contextOf, gitRepo } from '../../fixture.ts'
import check from './check.ts'

let dir = ''
afterAll(() => rm(dir, { recursive: true, force: true }))

test('fails on a raw <img>, and accepts the linters\' markers, next/og images and emails', async () => {
  dir = await gitRepo({
    'package.json': '{"dependencies":{"next":"16.2.0"}}',
    'src/Header.tsx': 'export const Header = () => (\n  <a>\n    <img\n      src="/logo.png"\n    />\n  </a>\n)\n',
    'src/Pixel.tsx': 'export const Pixel = () => (\n  // eslint-disable-next-line @next/next/no-img-element\n  <img src="https://t.example/p.gif" alt="" />\n)\n',
    'app/opengraph-image.tsx': 'export default () => <img src="x" />\n',
    'app/card/route.tsx': "import { ImageResponse } from 'next/og'\nexport const GET = () => new ImageResponse(<img src=\"x\" />)\n",
    'emails/Welcome.tsx': 'export default () => <img src="x" />\n',
    'src/Hero.tsx': "import Image from 'next/image'\nexport const Hero = () => <Image src=\"/a.png\" alt=\"\" width={1} height={1} />\n",
    'src/Hero.test.tsx': 'test(() => <img src="x" />)\n',
  })
  expect(await check(contextOf({ path: dir }))).toEqual({ state: 'fail', evidence: 'raw <img> instead of next/image: src/Header.tsx:3' })
})
