import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, child]) => [key, canonicalize(child)]),
    )
  }
  return value
}

export function stableJson(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

export function digest(value: unknown): string {
  return bytesToHex(sha256(new TextEncoder().encode(stableJson(value))))
}
