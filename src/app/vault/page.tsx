'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export default function VaultPage() {
  const { user } = useAuth()
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [allTags, setAllTags] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isMobile, setIsMobile] = useState(false)
  const [showExport, setShowExport] = useState(false)

  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener('resize', c); return () => window.removeEventListener('resize', c) }, [])
  useEffect(() => { loadVault() }, [])

  async function loadVault() {
    setLoading(true)
    const { data } = await supabase.from('lead_vault').select('*').order('archived_at', { ascending: false })
    setLeads(data || [])
    // Extract unique tags
    const tags = new Set<string>()
    for (const l of data || []) { for (const t of l.tags || []) tags.add(t) }
    setAllTags(Array.from(tags).sort())
    setLoading(false)
  }

  async function addTag(leadId: string, tag: string) {
    const lead = leads.find(l => l.id === leadId)
    if (!lead) return
    const newTags = [...new Set([...(lead.tags || []), tag])]
    await supabase.from('lead_vault').update({ tags: newTags }).eq('id', leadId)
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, tags: newTags } : l))
    if (!allTags.includes(tag)) setAllTags(prev => [...prev, tag].sort())
  }

  async function removeTag(leadId: string, tag: string) {
    const lead = leads.find(l => l.id === leadId)
    if (!lead) return
    const newTags = (lead.tags || []).filter((t: string) => t !== tag)
    await supabase.from('lead_vault').update({ tags: newTags }).eq('id', leadId)
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, tags: newTags } : l))
  }

  async function restoreToAccount(leadIds: string[], accountId?: string) {
    for (const id of leadIds) {
      const lead = leads.find(l => l.id === id)
      if (!lead) continue
      await supabase.from('leads').insert({
        name: lead.name, phone: lead.phone, email: lead.email, state: lead.state,
        insurance_type: lead.insurance_type, stage: 'new', score: lead.score || 30,
        source: 'vault', purchased_products: lead.purchased_products,
        notes: `Restaurado de vault. ${lead.notes || ''}`.trim(),
        agent_id: user?.id, account_id: accountId || user?.account_id,
      })
    }
    setSelected(new Set())
  }

  async function deleteFromVault(leadIds: string[]) {
    if (!confirm(`Eliminar ${leadIds.length} lead${leadIds.length > 1 ? 's' : ''} del vault permanentemente?`)) return
    for (const id of leadIds) { await supabase.from('lead_vault').delete().eq('id', id) }
    setLeads(prev => prev.filter(l => !leadIds.includes(l.id)))
    setSelected(new Set())
  }

  function exportCSV() {
    const rows = leads.filter(l => selected.size === 0 || selected.has(l.id))
    const csv = 'Nombre,Telefono,Email,Estado,Producto,Score,Tags,Origen,Notas\n' +
      rows.map(l => `"${l.name}","${l.phone}","${l.email || ''}","${l.state || ''}","${l.insurance_type || ''}",${l.score || 0},"${(l.tags || []).join(';')}","${l.from_account_name || ''}","${(l.notes || '').replace(/"/g, '""')}"`).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `vault_leads_${new Date().toISOString().split('T')[0]}.csv`; a.click()
  }

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function toggleAll() {
    setSelected(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(l => l.id)))
  }

  const filtered = leads.filter(l => {
    const q = search.toLowerCase()
    const matchSearch = !q || l.name?.toLowerCase().includes(q) || l.phone?.includes(q) || l.email?.toLowerCase().includes(q) || l.state?.toLowerCase().includes(q)
    const matchTag = !tagFilter || (l.tags || []).includes(tagFilter)
    return matchSearch && matchTag
  })

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Outfit:wght@300;400;500;600;700;800&display=swap');`}</style>
      <div style={{ padding: isMobile ? '24px 16px' : '40px 36px', background: '#06070B', minHeight: '100vh', fontFamily: '"Outfit","Inter",sans-serif', position: 'relative' }}>

        <div style={{ marginBottom: '28px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(201,168,76,0.6)', marginBottom: '6px' }}>VAULT</p>
          <h1 style={{ fontFamily: '"DM Serif Display",serif', fontSize: isMobile ? '32px' : '44px', color: '#F0ECE3', margin: 0, lineHeight: 1 }}>Lead Vault</h1>
          <p style={{ color: 'rgba(240,236,227,0.35)', fontSize: '13px', marginTop: '8px' }}>Leads archivados de sub-cuentas eliminadas. Etiqueta, filtra, y reutiliza para campanas.</p>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div style={{ padding: '12px 18px', borderRadius: '12px', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)' }}>
            <span style={{ fontSize: '20px', fontWeight: 800, color: '#C9A84C' }}>{leads.length}</span>
            <span style={{ fontSize: '12px', color: 'rgba(240,236,227,0.4)', marginLeft: '8px' }}>en vault</span>
          </div>
          <div style={{ padding: '12px 18px', borderRadius: '12px', background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)' }}>
            <span style={{ fontSize: '20px', fontWeight: 800, color: '#a78bfa' }}>{allTags.length}</span>
            <span style={{ fontSize: '12px', color: 'rgba(240,236,227,0.4)', marginLeft: '8px' }}>etiquetas</span>
          </div>
          {selected.size > 0 && (
            <div style={{ padding: '12px 18px', borderRadius: '12px', background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}>
              <span style={{ fontSize: '20px', fontWeight: 800, color: '#34d399' }}>{selected.size}</span>
              <span style={{ fontSize: '12px', color: 'rgba(240,236,227,0.4)', marginLeft: '8px' }}>seleccionados</span>
            </div>
          )}
        </div>

        {/* Search + filter + actions */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nombre, telefono, email..."
            style={{ flex: 1, minWidth: '200px', padding: '10px 16px', borderRadius: '10px', fontSize: '13px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#F0ECE3', outline: 'none', fontFamily: 'inherit' }} />

          <select value={tagFilter} onChange={e => setTagFilter(e.target.value)}
            style={{ padding: '10px 14px', borderRadius: '10px', fontSize: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#F0ECE3', fontFamily: 'inherit' }}>
            <option value="">Todas las etiquetas</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          {selected.size > 0 && (
            <>
              <button onClick={() => restoreToAccount(Array.from(selected))} style={{ padding: '10px 18px', borderRadius: '10px', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Restaurar al CRM ({selected.size})
              </button>
              <button onClick={() => deleteFromVault(Array.from(selected))} style={{ padding: '10px 18px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Eliminar ({selected.size})
              </button>
            </>
          )}

          <button onClick={exportCSV} style={{ padding: '10px 18px', borderRadius: '10px', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Exportar CSV
          </button>
        </div>

        {/* Leads table */}
        {loading ? <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(240,236,227,0.3)' }}>Cargando...</div> :
        filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: '48px', opacity: 0.15 }}>🔒</p>
            <p style={{ fontSize: '15px', color: 'rgba(240,236,227,0.25)' }}>{leads.length === 0 ? 'El vault esta vacio. Los leads se archivan aqui cuando eliminas una sub-cuenta.' : 'No hay resultados para tu busqueda.'}</p>
          </div>
        ) : (
          <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.04)' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 1fr 80px 100px 1fr 120px', gap: '1px', padding: '10px 14px', background: 'rgba(201,168,76,0.04)', fontSize: '10px', fontWeight: 700, color: 'rgba(240,236,227,0.4)', letterSpacing: '0.08em' }}>
              <div onClick={toggleAll} style={{ cursor: 'pointer', textAlign: 'center' }}>{selected.size === filtered.length ? '☑' : '☐'}</div>
              <div>NOMBRE</div><div>CONTACTO</div><div>ESTADO</div><div>PRODUCTO</div><div>ETIQUETAS</div><div>ORIGEN</div>
            </div>

            {/* Rows */}
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {filtered.map(l => {
                const isSelected = selected.has(l.id)
                return (
                  <div key={l.id} style={{
                    display: 'grid', gridTemplateColumns: '36px 1fr 1fr 80px 100px 1fr 120px', gap: '1px',
                    padding: '10px 14px', fontSize: '12px', cursor: 'pointer',
                    background: isSelected ? 'rgba(52,211,153,0.03)' : 'rgba(255,255,255,0.01)',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    color: '#F0ECE3',
                  }}>
                    <div onClick={() => toggleSelect(l.id)} style={{ textAlign: 'center' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: `1.5px solid ${isSelected ? '#34d399' : 'rgba(255,255,255,0.15)'}`, background: isSelected ? '#34d399' : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#06070B' }}>{isSelected ? '✓' : ''}</div>
                    </div>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 600 }}>{l.name}</span>
                      {l.score > 0 && <span style={{ marginLeft: '6px', fontSize: '10px', color: l.score >= 75 ? '#34d399' : l.score >= 50 ? '#fbbf24' : 'rgba(240,236,227,0.3)' }}>{l.score}</span>}
                    </div>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'rgba(240,236,227,0.5)' }}>
                      {l.phone}{l.email ? ` · ${l.email}` : ''}
                    </div>
                    <div style={{ color: 'rgba(240,236,227,0.4)' }}>{l.state || '-'}</div>
                    <div style={{ color: 'rgba(240,236,227,0.4)', textTransform: 'capitalize' }}>{l.insurance_type || '-'}</div>
                    <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {(l.tags || []).map((t: string) => (
                        <span key={t} onClick={(e) => { e.stopPropagation(); removeTag(l.id, t) }} title="Click para quitar" style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '100px', background: 'rgba(167,139,250,0.1)', color: '#a78bfa', cursor: 'pointer' }}>{t} ×</span>
                      ))}
                      <span onClick={(e) => {
                        e.stopPropagation()
                        const tag = prompt('Nueva etiqueta:')
                        if (tag) addTag(l.id, tag.trim().toLowerCase())
                      }} style={{ fontSize: '9px', padding: '2px 5px', borderRadius: '100px', background: 'rgba(255,255,255,0.03)', color: 'rgba(240,236,227,0.25)', cursor: 'pointer' }}>+</span>
                    </div>
                    <div style={{ fontSize: '10px', color: 'rgba(240,236,227,0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.from_account_name || '-'}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
