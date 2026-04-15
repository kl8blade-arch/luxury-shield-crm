'use client'
// src/components/CommandPalette.tsx
// Uso: importar en dashboard/layout.tsx y agregar <CommandPalette />

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

interface Lead {
  id: string
  name: string
  phone: string
  stage: string
  score: number
  insurance_type: string
}

interface Result {
  type: 'lead' | 'module' | 'action'
  id: string
  label: string
  sub?: string
  emoji: string
  href?: string
  action?: () => void
  score?: number
}

const MODULES: Result[] = [
  { type: 'module', id: 'dashboard', emoji: '📊', label: 'Dashboard', sub: 'Vista principal', href: '/dashboard' },
  { type: 'module', id: 'pipeline',  emoji: '🎯', label: 'Pipeline Kanban', sub: 'Gestión de leads', href: '/dashboard/pipeline' },
  { type: 'module', id: 'money',     emoji: '💰', label: 'Money Command', sub: 'Comisiones y pólizas', href: '/dashboard/money' },
  { type: 'module', id: 'citas',     emoji: '📅', label: 'SophiaCita', sub: 'Citas médicas', href: '/dashboard/citas' },
  { type: 'module', id: 'leads',     emoji: '👥', label: 'Leads', sub: 'Todos los leads', href: '/leads' },
  { type: 'module', id: 'settings',  emoji: '⚙️', label: 'Configuración', sub: 'Settings', href: '/settings' },
]

const scoreColor = (s: number) => s >= 75 ? '#00E5A0' : s >= 50 ? '#FFB930' : '#FF4757'

export function CommandPalette() {
  const { user }  = useAuth()
  const router    = useRouter()
  const [open, setOpen]         = useState(false)
  const [query, setQuery]       = useState('')
  const [leads, setLeads]       = useState<Lead[]>([])
  const [loading, setLoading]   = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef  = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Open/close with Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setLeads([])
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Search leads
  const searchLeads = useCallback(async (q: string) => {
    if (!user?.id || q.length < 2) { setLeads([]); return }
    setLoading(true)
    try {
      const r = await fetch(`/api/leads/search?q=${encodeURIComponent(q)}&agentId=${user.id}`)
      if (!r.ok) return
      const { data } = await r.json()
      setLeads(data ?? [])
    } catch { setLeads([]) }
    finally { setLoading(false) }
  }, [user])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchLeads(query), 200)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, searchLeads])

  // Build results list
  const filteredModules = MODULES.filter(m =>
    !query || m.label.toLowerCase().includes(query.toLowerCase()) ||
    (m.sub ?? '').toLowerCase().includes(query.toLowerCase())
  )

  const leadResults: Result[] = leads.map(l => ({
    type:  'lead',
    id:    l.id,
    emoji: '👤',
    label: l.name,
    sub:   `${l.phone} · ${l.insurance_type} · Score ${l.score}`,
    href:  `/dashboard/pipeline`,
    score: l.score,
  }))

  const results: Result[] = [
    ...leadResults,
    ...(leadResults.length > 0 ? [] : filteredModules),
    ...(leadResults.length > 0 ? filteredModules : []),
  ]

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && results[selected]) {
      execute(results[selected])
    }
  }

  const execute = (result: Result) => {
    setOpen(false)
    if (result.action) result.action()
    else if (result.href) router.push(result.href)
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 999 }}
      />

      {/* Palette */}
      <div style={{
        position: 'fixed', top: '15%', left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 560, zIndex: 1000,
        background: 'rgba(13,8,40,0.97)',
        border: '1px solid rgba(149,76,233,0.35)',
        borderRadius: 16,
        boxShadow: '0 25px 60px rgba(0,0,0,0.7), 0 0 40px rgba(149,76,233,0.15)',
        backdropFilter: 'blur(24px)',
        overflow: 'hidden',
        animation: 'paletteIn 0.15s ease',
      }}>
        <style>{`
          @keyframes paletteIn {
            from { opacity: 0; transform: translateX(-50%) translateY(-12px) scale(0.97) }
            to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1) }
          }
        `}</style>

        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid rgba(149,76,233,0.2)' }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>{loading ? '⏳' : '🔍'}</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Buscar lead, módulo o comando..."
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 15, color: '#f0eaff', fontFamily: 'inherit', caretColor: '#9B59B6' }}
          />
          <div style={{ padding: '2px 7px', background: 'rgba(255,255,255,0.08)', borderRadius: 6, fontSize: 10, color: 'rgba(200,180,255,0.5)', flexShrink: 0, fontFamily: 'monospace' }}>
            ESC
          </div>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {results.length === 0 && query.length > 0 && !loading && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'rgba(200,180,255,0.4)', fontSize: 13 }}>
              Sin resultados para &quot;{query}&quot;
            </div>
          )}

          {results.length === 0 && !query && (
            <div style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: 'rgba(200,180,255,0.4)', textTransform: 'uppercase', marginBottom: 8 }}>Accesos rápidos</div>
              {MODULES.map((m, i) => (
                <button key={m.id} onClick={() => execute(m)}
                  onMouseEnter={() => setSelected(i)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '9px 10px', borderRadius: 8, background: selected === i ? 'rgba(155,89,182,0.15)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', marginBottom: 2 }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{m.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f0eaff' }}>{m.label}</div>
                    <div style={{ fontSize: 11, color: 'rgba(200,180,255,0.5)' }}>{m.sub}</div>
                  </div>
                  <span style={{ fontSize: 10, color: 'rgba(200,180,255,0.3)', fontFamily: 'monospace' }}>→</span>
                </button>
              ))}
            </div>
          )}

          {results.length > 0 && (
            <div style={{ padding: '8px' }}>
              {/* Leads section */}
              {leadResults.length > 0 && (
                <>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: 'rgba(200,180,255,0.4)', textTransform: 'uppercase', padding: '4px 8px 6px', marginBottom: 2 }}>Leads</div>
                  {leadResults.map((r, i) => (
                    <button key={r.id} onClick={() => execute(r)}
                      onMouseEnter={() => setSelected(i)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '9px 10px', borderRadius: 8, background: selected === i ? 'rgba(155,89,182,0.15)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', marginBottom: 2 }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{r.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#f0eaff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</div>
                        <div style={{ fontSize: 11, color: 'rgba(200,180,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.sub}</div>
                      </div>
                      {r.score !== undefined && (
                        <div style={{ fontSize: 14, fontWeight: 900, color: scoreColor(r.score), flexShrink: 0 }}>{r.score}</div>
                      )}
                    </button>
                  ))}
                </>
              )}

              {/* Modules section */}
              {filteredModules.length > 0 && (
                <>
                  {leadResults.length > 0 && <div style={{ height: 1, background: 'rgba(149,76,233,0.15)', margin: '8px 8px' }}/>}
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: 'rgba(200,180,255,0.4)', textTransform: 'uppercase', padding: '4px 8px 6px' }}>Módulos</div>
                  {filteredModules.map((r, i) => {
                    const idx = leadResults.length + i
                    return (
                      <button key={r.id} onClick={() => execute(r)}
                        onMouseEnter={() => setSelected(idx)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '9px 10px', borderRadius: 8, background: selected === idx ? 'rgba(155,89,182,0.15)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', marginBottom: 2 }}>
                        <span style={{ fontSize: 18, flexShrink: 0 }}>{r.emoji}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#f0eaff' }}>{r.label}</div>
                          <div style={{ fontSize: 11, color: 'rgba(200,180,255,0.5)' }}>{r.sub}</div>
                        </div>
                        <span style={{ fontSize: 10, color: 'rgba(200,180,255,0.3)', fontFamily: 'monospace' }}>→</span>
                      </button>
                    )
                  })}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(149,76,233,0.15)', display: 'flex', gap: 12, alignItems: 'center' }}>
          {[['↑↓', 'Navegar'], ['↵', 'Abrir'], ['esc', 'Cerrar']].map(([key, label]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ padding: '1px 5px', background: 'rgba(255,255,255,0.08)', borderRadius: 4, fontSize: 10, fontFamily: 'monospace', color: 'rgba(200,180,255,0.6)' }}>{key}</span>
              <span style={{ fontSize: 10, color: 'rgba(200,180,255,0.4)' }}>{label}</span>
            </div>
          ))}
          <div style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(200,180,255,0.25)' }}>SophiaOS</div>
        </div>
      </div>
    </>
  )
}
