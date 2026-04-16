'use client'
// src/app/conversations/page.tsx

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface Conversation {
  id: string
  lead_name: string | null
  lead_phone: string
  direction: 'inbound' | 'outbound'
  message: string | null
  channel: string
  sentiment: string | null
  created_at: string
  lead_id: string | null
}

interface ConversationGroup {
  lead_phone: string
  lead_name: string | null
  lead_id: string | null
  messages: Conversation[]
  lastMessage: string
  lastTime: string
  unread: number
  sentiment: string | null
}

const T = {
  bg:     '#0d0820',
  panel:  'rgba(255,255,255,0.05)',
  border: 'rgba(149,76,233,0.18)',
  text:   '#f0eaff',
  muted:  'rgba(200,180,255,0.45)',
  accent: '#9B59B6',
  green:  '#00E5A0',
  red:    '#FF4757',
  gold:   '#FFB930',
  cyan:   '#00D4FF',
}

const SENTIMENT_COLOR: Record<string, string> = {
  positive:     '#00E5A0',
  interested:   '#00D4FF',
  neutral:      '#888',
  negative:     '#FF4757',
  not_interested: '#FF4757',
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'ahora'
  if (mins < 60)  return `${mins}m`
  if (hours < 24) return `${hours}h`
  return `${days}d`
}

export default function ConversationsPage() {
  const { user } = useAuth()
  const [groups,   setGroups]   = useState<ConversationGroup[]>([])
  const [selected, setSelected] = useState<ConversationGroup | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')

  const fetchConversations = useCallback(async () => {
    if (!user?.id) return
    try {
      const r = await fetch(`/api/conversations?agentId=${user.id}&limit=200`)
      if (!r.ok) return
      const { data } = await r.json()
      const convs: Conversation[] = data ?? []

      // Group by lead_phone
      const groupMap: Record<string, ConversationGroup> = {}
      convs.forEach(c => {
        const key = c.lead_phone
        if (!groupMap[key]) {
          groupMap[key] = {
            lead_phone: c.lead_phone,
            lead_name:  c.lead_name,
            lead_id:    c.lead_id,
            messages:   [],
            lastMessage: '',
            lastTime:   c.created_at,
            unread:     0,
            sentiment:  null,
          }
        }
        groupMap[key].messages.push(c)
        if (new Date(c.created_at) > new Date(groupMap[key].lastTime)) {
          groupMap[key].lastTime   = c.created_at
          groupMap[key].lastMessage = c.message ?? ''
        }
        if (c.direction === 'inbound') groupMap[key].unread++
        if (c.sentiment) groupMap[key].sentiment = c.sentiment
      })

      const sorted = Object.values(groupMap)
        .sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime())
      setGroups(sorted)
    } catch (e) {
      console.error('[Conversations]', e)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchConversations() }, [fetchConversations])

  const filtered = groups.filter(g =>
    !search ||
    (g.lead_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    g.lead_phone.includes(search)
  )

  if (loading) return (
    <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui', color: T.muted }}>
      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 32, marginBottom: 12 }}>💬</div><div>Cargando conversaciones...</div></div>
    </div>
  )

  return (
    <div style={{ background: T.bg, minHeight: '100vh', fontFamily: "'SF Pro Display',system-ui,sans-serif", color: T.text, display: 'flex', flexDirection: 'column' }}>

      {/* HEADER */}
      <div style={{ background: 'rgba(13,8,32,0.92)', backdropFilter: 'blur(20px)', borderBottom: `1px solid ${T.border}`, padding: '12px 20px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 20 }}>💬</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Conversaciones</div>
            <div style={{ fontSize: 9, color: T.muted, letterSpacing: 2, textTransform: 'uppercase' }}>{groups.length} chats activos</div>
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o teléfono..."
            style={{ flex: 1, maxWidth: 300, padding: '7px 14px', background: 'rgba(255,255,255,0.07)', border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 12, color: T.text, outline: 'none', fontFamily: 'inherit', marginLeft: 12 }}
          />
          <button onClick={fetchConversations} style={{ padding: '6px 14px', background: `${T.accent}20`, border: `1px solid ${T.accent}40`, borderRadius: 8, fontSize: 11, fontWeight: 700, color: T.accent, cursor: 'pointer', marginLeft: 'auto' }}>↺</button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* CONVERSATION LIST */}
        <div style={{ width: selected ? 320 : '100%', flexShrink: 0, borderRight: selected ? `1px solid ${T.border}` : 'none', overflow: 'auto' }}>
          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: T.muted }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
              <div>No hay conversaciones aún</div>
            </div>
          )}
          {filtered.map(group => {
            const isSelected = selected?.lead_phone === group.lead_phone
            const initial    = (group.lead_name ?? group.lead_phone)[0]?.toUpperCase()
            return (
              <div key={group.lead_phone} onClick={() => setSelected(isSelected ? null : group)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: `1px solid ${T.border}`, cursor: 'pointer', background: isSelected ? `${T.accent}12` : 'transparent', transition: 'background 0.15s' }}>
                {/* Avatar */}
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: `linear-gradient(135deg,${T.accent},${T.cyan})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
                  {initial}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {group.lead_name ?? group.lead_phone}
                    </div>
                    <div style={{ fontSize: 10, color: T.muted, flexShrink: 0, marginLeft: 8 }}>{timeAgo(group.lastTime)}</div>
                  </div>
                  <div style={{ fontSize: 11, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {group.lastMessage || '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                  {group.sentiment && SENTIMENT_COLOR[group.sentiment] && (
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: SENTIMENT_COLOR[group.sentiment] }}/>
                  )}
                  <div style={{ fontSize: 9, color: T.muted }}>{group.messages.length} msgs</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* MESSAGE THREAD */}
        {selected && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Thread header */}
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(13,8,32,0.6)' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(135deg,${T.accent},${T.cyan})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
                {(selected.lead_name ?? selected.lead_phone)[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{selected.lead_name ?? selected.lead_phone}</div>
                <div style={{ fontSize: 10, color: T.muted, fontFamily: 'monospace' }}>{selected.lead_phone}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <a href={`https://wa.me/${selected.lead_phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                  style={{ padding: '6px 12px', background: '#25D36618', border: '1px solid #25D36630', borderRadius: 8, fontSize: 11, fontWeight: 700, color: '#25D366', textDecoration: 'none' }}>
                  💬 WhatsApp
                </a>
                <button onClick={() => setSelected(null)} style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: `1px solid ${T.border}`, cursor: 'pointer', color: T.muted, fontSize: 16 }}>✕</button>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...selected.messages]
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                .map((msg, i) => {
                  const isOut = msg.direction === 'outbound'
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: isOut ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth: '75%',
                        padding: '10px 14px',
                        borderRadius: isOut ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        background: isOut ? `${T.accent}25` : 'rgba(255,255,255,0.07)',
                        border: `1px solid ${isOut ? T.accent + '40' : T.border}`,
                      }}>
                        <div style={{ fontSize: 12, lineHeight: 1.6, color: T.text, whiteSpace: 'pre-wrap' }}>
                          {msg.message || '—'}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, gap: 8 }}>
                          <div style={{ fontSize: 9, color: T.muted }}>
                            {new Date(msg.created_at).toLocaleTimeString('es-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </div>
                          {msg.sentiment && SENTIMENT_COLOR[msg.sentiment] && (
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: SENTIMENT_COLOR[msg.sentiment] }}/>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
