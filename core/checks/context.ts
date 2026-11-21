import type { Business, Asset } from '../schema.ts'
import type { LoadedItem } from '../load.ts'

export interface Context {
  business: Business
  asset: Asset
  item: LoadedItem
  /** The workspace's folder, for checks that read its `secrets.yml`. */
  wsDir?: string
}
