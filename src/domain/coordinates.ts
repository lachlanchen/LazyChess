import type { BoardShape, Variant } from './types'

export function square(x: number, y: number): string {
  return `${String.fromCharCode(97 + x)}${y + 1}`
}

export function point(value: string): { x: number; y: number } {
  return { x: value.charCodeAt(0) - 97, y: Number(value.slice(1)) - 1 }
}

export function inside(shape: BoardShape, x: number, y: number): boolean {
  return x >= 0 && x < shape.files && y >= 0 && y < shape.ranks
}

export function displayCoordinate(variant: Variant, coordinate: string): string {
  if (variant !== 'chess') return coordinate
  return `${coordinate[0]}${9 - Number(coordinate.slice(1))}`
}
