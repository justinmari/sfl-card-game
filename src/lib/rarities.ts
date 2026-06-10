export const RARITIES = [
  { value: 'common', label: 'Common' },
  { value: 'uncommon', label: 'Uncommon' },
  { value: 'rare', label: 'Rare' },
  { value: 'ultra_rare', label: 'Ultra Rare' },
  { value: 'secret_rare', label: 'Secret Rare' },
  { value: 'legendary', label: 'Legendary' },
] as const

export const rarityBadgeColors: Record<string, string> = {
  common: 'bg-zinc-600',
  uncommon: 'bg-green-700',
  rare: 'bg-blue-700',
  ultra_rare: 'bg-purple-700',
  secret_rare: 'bg-pink-700',
  legendary: 'bg-amber-700',
}

export const rarityLabel: Record<string, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  ultra_rare: 'Ultra Rare',
  secret_rare: 'Secret Rare',
  legendary: 'Legendary',
}
