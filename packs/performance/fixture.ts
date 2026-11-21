import type { Context } from '../../core/checks/context.ts'
import type { LoadedItem } from '../../core/load.ts'
import type { Asset, Business } from '../../core/schema.ts'

const business = { id: 'acme', name: 'Acme', assets: [], packs: [], waivers: [] } as unknown as Business

export const contextOf = (asset: Partial<Asset>): Context => ({
  business,
  asset: { id: 'site', kind: 'website', ...asset } as Asset,
  item: {} as LoadedItem,
})
