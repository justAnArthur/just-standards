import type { Business, Asset } from '../schema.ts'
import type { LoadedItem } from '../load.ts'

export interface Context {
  business: Business
  asset: Asset
  item: LoadedItem
}
