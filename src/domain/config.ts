import type { BoardShape, Variant } from './types'

export interface VariantConfig {
  id: Variant
  shape: BoardShape
  nameKey: string
  subtitleKey: string
  scopeKey: string
  scopeTone: 'complete' | 'subset'
}

export const variants: VariantConfig[] = [
  {
    id: 'chess',
    shape: { files: 8, ranks: 8 },
    nameKey: 'variant.chess.name',
    subtitleKey: 'variant.chess.subtitle',
    scopeKey: 'variant.chess.scope',
    scopeTone: 'complete',
  },
  {
    id: 'xiangqi',
    shape: { files: 9, ranks: 10 },
    nameKey: 'variant.xiangqi.name',
    subtitleKey: 'variant.xiangqi.subtitle',
    scopeKey: 'variant.xiangqi.scope',
    scopeTone: 'subset',
  },
  {
    id: 'shogi',
    shape: { files: 9, ranks: 9 },
    nameKey: 'variant.shogi.name',
    subtitleKey: 'variant.shogi.subtitle',
    scopeKey: 'variant.shogi.scope',
    scopeTone: 'subset',
  },
]

export function variantConfig(variant: Variant): VariantConfig {
  const config = variants.find((item) => item.id === variant)
  if (!config) throw new Error(`Unknown variant: ${variant}`)
  return config
}
