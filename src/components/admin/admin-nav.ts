import {
  Images, Ghost, Tags, Sparkles, Package, Gem,
  Zap, Combine, Settings, Users, Gift, Inbox, Receipt, type LucideIcon,
} from 'lucide-react'

export type AdminNavItem = { href: string; label: string; subtitle: string; icon: LucideIcon }
export type AdminNavGroup = { label: string; items: AdminNavItem[] }

/** Grouped admin sections — shared by the admin sidebar and the /admin overview. */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: 'General',
    items: [
      { href: '/admin/arena', label: 'Feature Settings', subtitle: 'Toggle features', icon: Settings },
    ],
  },
  {
    label: 'Player Interactions',
    items: [
      { href: '/admin/care-packages', label: 'Care Packages', subtitle: 'Send Gruten gifts', icon: Gift },
      { href: '/admin/suggestions', label: 'Suggestions', subtitle: 'Review card ideas', icon: Inbox },
    ],
  },
  {
    label: 'Content',
    items: [
      { href: '/admin/cards', label: 'Cards', subtitle: 'Upload & edit cards', icon: Images },
      { href: '/admin/creatures', label: 'Creatures', subtitle: 'Card characters', icon: Ghost },
      { href: '/admin/types', label: 'Types', subtitle: 'Type labels', icon: Tags },
    ],
  },
  {
    label: 'Packs',
    items: [
      { href: '/admin/packs', label: 'Packs', subtitle: 'Configure packs', icon: Package },
      { href: '/admin/holo', label: 'Holo Editions', subtitle: 'Finishes & pull rates', icon: Gem },
    ],
  },
  {
    label: 'Arena Systems',
    items: [
      { href: '/admin/battle-effects', label: 'Battle Effects', subtitle: 'Compose effects', icon: Zap },
      { href: '/admin/synergies', label: 'Synergies', subtitle: 'Deck-type combos', icon: Combine },
      { href: '/admin/skills', label: 'Skills', subtitle: 'Card abilities', icon: Sparkles },
    ],
  },
  {
    label: 'Player Management',
    items: [
      { href: '/admin/users', label: 'Users', subtitle: 'Manage accounts', icon: Users },
    ],
  },
  {
    label: 'Audit',
    items: [
      { href: '/admin/transactions', label: 'Gruten Logs', subtitle: 'Transaction history', icon: Receipt },
    ],
  },
]
