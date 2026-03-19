// ── DESIGN SYSTEM ─────────────────────────────────────────────
export const C = {
  // Backgrounds
  bg:       '#07080A',
  surface:  '#0f1115',
  surface2: '#131720',
  surface3: '#181d27',
  // Borders
  border:     'rgba(255,255,255,0.07)',
  borderMd:   'rgba(255,255,255,0.11)',
  borderGold: 'rgba(201,168,76,0.28)',
  // Text
  text:      '#F0ECE3',
  textDim:   'rgba(240,236,227,0.58)',
  textMuted: 'rgba(240,236,227,0.34)',
  // Brand
  gold:      '#C9A84C',
  goldBright:'#E2C060',
  goldDim:   '#8B6E2E',
  // Status
  green: '#34d399',
  yellow:'#fbbf24',
  red:   '#f87171',
  blue:  '#60a5fa',
  // Font
  font: '"Inter","Segoe UI",sans-serif',
}

export const STAGE_META: Record<string, { label: string; color: string; dot: string; bg: string }> = {
  new:          { label: 'Nuevo',          color: '#60a5fa', dot: '#3b82f6', bg: 'rgba(96,165,250,0.1)'   },
  contact:      { label: 'Por contactar',  color: '#fbbf24', dot: '#f59e0b', bg: 'rgba(251,191,36,0.1)'   },
  contacted:    { label: 'Contactado',     color: '#a78bfa', dot: '#8b5cf6', bg: 'rgba(167,139,250,0.1)'  },
  interested:   { label: 'Interesado',     color: '#f97316', dot: '#ea580c', bg: 'rgba(249,115,22,0.1)'   },
  proposal:     { label: 'Propuesta',      color: '#22d3ee', dot: '#0891b2', bg: 'rgba(34,211,238,0.1)'   },
  negotiation:  { label: 'Negociación',    color: '#f472b6', dot: '#db2777', bg: 'rgba(244,114,182,0.1)'  },
  closed_won:   { label: 'Cerrado ✓',      color: '#34d399', dot: '#059669', bg: 'rgba(52,211,153,0.1)'   },
  closed_lost:  { label: 'Perdido',        color: '#f87171', dot: '#dc2626', bg: 'rgba(248,113,113,0.1)'  },
  unqualified:  { label: 'No calificado',  color: '#9ca3af', dot: '#6b7280', bg: 'rgba(156,163,175,0.1)'  },
}

export const scoreColor = (s: number) =>
  s >= 75 ? '#34d399' : s >= 50 ? '#fbbf24' : '#f87171'

export const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })

export const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
