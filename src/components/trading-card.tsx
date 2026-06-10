'use client'

const rarityColors: Record<string, string> = {
  common: 'border-zinc-500',
  uncommon: 'border-green-500',
  rare: 'border-blue-500',
  ultra_rare: 'border-purple-500',
  secret_rare: 'border-pink-500',
  legendary: 'border-amber-500',
}

const rarityBgColors: Record<string, string> = {
  common: 'from-zinc-800 to-zinc-900',
  uncommon: 'from-green-950 to-zinc-900',
  rare: 'from-blue-950 to-zinc-900',
  ultra_rare: 'from-purple-950 to-zinc-900',
  secret_rare: 'from-pink-950 to-zinc-900',
  legendary: 'from-amber-950 to-zinc-900',
}

const rarityBadgeColors: Record<string, string> = {
  common: 'bg-zinc-600',
  uncommon: 'bg-green-700',
  rare: 'bg-blue-700',
  ultra_rare: 'bg-purple-700',
  secret_rare: 'bg-pink-700',
  legendary: 'bg-amber-700',
}

const rarityGlow: Record<string, string> = {
  common: '',
  uncommon: 'shadow-[0_0_20px_rgba(34,197,94,0.15)]',
  rare: 'shadow-[0_0_20px_rgba(59,130,246,0.25)]',
  ultra_rare: 'shadow-[0_0_25px_rgba(168,85,247,0.3)]',
  secret_rare: 'shadow-[0_0_25px_rgba(236,72,153,0.3)]',
  legendary: 'shadow-[0_0_25px_rgba(245,158,11,0.35)]',
}

const rarityLabel: Record<string, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  ultra_rare: 'Ultra Rare',
  secret_rare: 'Secret Rare',
  legendary: 'Legendary',
}

type CardData = {
  id: string
  name: string
  description?: string | null
  image_url: string | null
  rarity: string
}

type Size = 'sm' | 'md' | 'lg'

const sizeClasses: Record<Size, { wrapper: string; image: string; padding: string; name: string; badge: string }> = {
  sm: {
    wrapper: 'w-[7.5rem]',
    image: 'aspect-[2.5/3.5] w-full',
    padding: 'px-2 py-1.5',
    name: 'text-[11px]',
    badge: 'text-[9px] px-1 py-0.5',
  },
  md: {
    wrapper: 'w-[10rem]',
    image: 'aspect-[2.5/3.5] w-full',
    padding: 'px-3 py-2',
    name: 'text-xs',
    badge: 'text-[10px] px-1.5 py-0.5',
  },
  lg: {
    wrapper: 'w-[16rem]',
    image: 'aspect-[2.5/3.5] w-full',
    padding: 'px-4 py-3',
    name: 'text-sm',
    badge: 'text-xs px-2 py-0.5',
  },
}

export default function TradingCard({
  card,
  size = 'md',
  count,
  onClick,
  className = '',
  children,
}: {
  card: CardData
  size?: Size
  count?: number
  onClick?: () => void
  className?: string
  children?: React.ReactNode
}) {
  const s = sizeClasses[size]
  const Component = onClick ? 'button' : 'div'

  return (
    <Component
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl border-2 bg-gradient-to-b ${rarityColors[card.rarity]} ${rarityBgColors[card.rarity]} ${rarityGlow[card.rarity]} ${s.wrapper} ${onClick ? 'text-left transition-transform hover:scale-105' : ''} ${className}`}
    >
      {card.image_url ? (
        <img
          src={card.image_url}
          alt={card.name}
          className={`${s.image} object-cover`}
        />
      ) : (
        <div className={`${s.image} flex items-center justify-center bg-zinc-800`}>
          <span className="text-2xl">🃏</span>
        </div>
      )}
      <div className={s.padding}>
        <p className={`${s.name} font-semibold truncate`}>{card.name}</p>
        <span className={`${s.badge} mt-1 inline-block rounded ${rarityBadgeColors[card.rarity]}`}>
          {rarityLabel[card.rarity] || card.rarity}
        </span>
      </div>
      {count && count > 1 && (
        <span className="absolute right-1.5 top-1.5 rounded-full bg-zinc-800/90 px-1.5 py-0.5 text-[10px] font-bold">
          x{count}
        </span>
      )}
      {children}
    </Component>
  )
}

export { rarityColors, rarityBgColors, rarityBadgeColors, rarityGlow, rarityLabel }
