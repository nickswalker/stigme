import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

const defaults: P = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }

// ── Navigation ────────────────────────────────────

export function IconMenu(p: P) {
  return <svg {...defaults} {...p}>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
}

export function IconClose(p: P) {
  return <svg {...defaults} {...p}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
}

export function IconChevronRight(p: P) {
  return <svg {...defaults} {...p}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
}

export function IconChevronLeft(p: P) {
  return <svg {...defaults} {...p}>
    <polyline points="15 18 9 12 15 6" />
  </svg>
}

export function IconDragHandle(p: P) {
  return <svg {...defaults} {...p}>
    <line x1="3" y1="8" x2="21" y2="8" />
    <line x1="3" y1="16" x2="21" y2="16" />
  </svg>
}

export function IconExternalLink(p: P) {
  return <svg {...defaults} {...p}>
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
}

// ── Actions ───────────────────────────────────────

export function IconSettings(p: P) {
  return <svg {...defaults} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
}

export function IconEdit(p: P) {
  return <svg {...defaults} {...p}>
    <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
}

export function IconNote(p: P) {
  return <svg {...defaults} {...p}>
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 7.5-7.5z" />
  </svg>
}

export function IconUndo(p: P) {
  return <svg {...defaults} {...p}>
    <polyline points="9 14 4 9 9 4" />
    <path d="M20 20v-7a4 4 0 00-4-4H4" />
  </svg>
}

export function IconReset(p: P) {
  return <svg {...defaults} {...p}>
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
  </svg>
}

export function IconDecrement(p: P) {
  return <svg {...defaults} strokeWidth={2.5} {...p}>
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
}

export function IconPlus(p: P) {
  return <svg {...defaults} {...p}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
}

export function IconDownload(p: P) {
  return <svg {...defaults} {...p}>
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
}

export function IconTrash(p: P) {
  return <svg {...defaults} {...p}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4h6v2" />
  </svg>
}

export function IconMic(p: P) {
  return <svg {...defaults} {...p}>
    <rect x="9" y="2" width="6" height="11" rx="3" />
    <path d="M5 10a7 7 0 0014 0" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="9" y1="22" x2="15" y2="22" />
  </svg>
}

// ── Content ───────────────────────────────────────

export function IconNoteDoc(p: P) {
  return <svg {...defaults} {...p}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
}

interface MultiGridProps extends P {
  slots: string[]
}

export function IconMultiGrid({ slots, ...p }: MultiGridProps) {
  const positions = [
    { x: 3, y: 3 }, { x: 13, y: 3 },
    { x: 3, y: 13 }, { x: 13, y: 13 },
  ]
  return <svg viewBox="0 0 24 24" {...p}>
    {positions.map((pos, i) => (
      <rect
        key={i}
        x={pos.x} y={pos.y}
        width="8" height="8" rx="1.5"
        fill={slots[i] || 'currentColor'}
        opacity={slots[i] ? 1 : 0.25}
      />
    ))}
  </svg>
}
