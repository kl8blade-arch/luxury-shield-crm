'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import FileUpload from '@/components/FileUpload'

interface ParsedContact {
  name: string
  phone: string
  email: string
  state: string
  product: string
  notes: string
  selected: boolean
}

const PRODUCT_TAGS = [
  { key: 'dental', label: 'Dental', color: '#34d399' },
  { key: 'aca', label: 'ACA', color: '#60a5fa' },
  { key: 'vida', label: 'Vida/IUL', color: '#C9A84C' },
  { key: 'medicare', label: 'Medicare', color: '#a78bfa' },
  { key: 'auto', label: 'Auto', color: '#f97316' },
  { key: 'hogar', label: 'Hogar', color: '#06b6d4' },
  { key: 'otro', label: 'Otro', color: '#6b7280' },
]

export default function ImportPage() {
  const { user } = useAuth()
  const [step, setStep] = useState<'upload' | 'preview' | 'assign' | 'done'>('upload')
  const [contacts, setContacts] = useState<ParsedContact[]>([])
  const [fileName, setFileName] = useState('')
  const [fileType, setFileType] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState({ total: 0, created: 0, duplicates: 0 })
  const [defaultProduct, setDefaultProduct] = useState('')
  const [batchName, setBatchName] = useState('')
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768)
  const [parseError, setParseError] = useState('')

  async function handleFile(file: File) {
    setParseError('')
    setFileName(file.name)
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    setFileType(ext)

    try {
      if (ext === 'csv') {
        const text = await file.text()
        parseCSV(text)
      } else if (ext === 'xlsx' || ext === 'xls') {
        const XLSX = (await import('xlsx'))
        const buffer = await file.arrayBuffer()
        const wb = XLSX.read(buffer, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][]
        parseSpreadsheetRows(rows)
      } else if (ext === 'txt') {
        const text = await file.text()
        parseCSV(text)
      } else {
        setParseError(`Formato .${ext} no soportado. Usa CSV, Excel (.xlsx), o TXT.`)
        return
      }

      setBatchName(file.name.replace(/\.[^.]+$/, ''))
      setStep('preview')
    } catch (err: any) {
      setParseError(`Error al leer archivo: ${err.message}`)
    }
  }

  function parseCSV(text: string) {
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    if (lines.length < 2) { setParseError('El archivo esta vacio o solo tiene encabezados'); return }

    const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ','
    const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
    const rows = lines.slice(1).map(l => l.split(sep).map(c => c.trim().replace(/^["']|["']$/g, '')))
    parseWithHeaders(headers, rows)
  }

  function parseSpreadsheetRows(rows: any[][]) {
    if (rows.length < 2) { setParseError('La hoja esta vacia'); return }
    const headers = rows[0].map((h: any) => String(h || '').toLowerCase().trim())
    const dataRows = rows.slice(1).map(r => r.map((c: any) => String(c || '').trim()))
    parseWithHeaders(headers, dataRows)
  }

  function parseWithHeaders(headers: string[], rows: string[][]) {
    // Smart column detection
    const nameCol = headers.findIndex(h => /^(nombre|name|full.?name|cliente|contact)/.test(h))
    const phoneCol = headers.findIndex(h => /^(tel|phone|celular|movil|whatsapp|numero|cell|mobile)/.test(h))
    const emailCol = headers.findIndex(h => /^(email|correo|e-?mail|mail)/.test(h))
    const stateCol = headers.findIndex(h => /^(estado|state|st|provincia)/.test(h))
    const productCol = headers.findIndex(h => /^(producto|product|seguro|insurance|tipo|type|servicio|service|plan)/.test(h))
    const notesCol = headers.findIndex(h => /^(notas?|notes?|comentario|observacion|memo)/.test(h))

    if (nameCol === -1 && phoneCol === -1 && emailCol === -1) {
      // Try first 3 columns as name, phone, email
      const parsed = rows.filter(r => r.length >= 2).map(r => ({
        name: r[0] || '', phone: r[1] || '', email: r[2] || '',
        state: r[3] || '', product: r[4] || '', notes: r[5] || '', selected: true,
      }))
      setContacts(parsed.filter(c => c.name || c.phone || c.email))
      return
    }

    const parsed = rows.filter(r => r.some(c => c)).map(r => ({
      name: nameCol >= 0 ? r[nameCol] || '' : '',
      phone: phoneCol >= 0 ? r[phoneCol] || '' : '',
      email: emailCol >= 0 ? r[emailCol] || '' : '',
      state: stateCol >= 0 ? r[stateCol] || '' : '',
      product: productCol >= 0 ? r[productCol] || '' : '',
      notes: notesCol >= 0 ? r[notesCol] || '' : '',
      selected: true,
    }))

    setContacts(parsed.filter(c => c.name || c.phone || c.email))
  }

  function toggleContact(idx: number) {
    setContacts(prev => prev.map((c, i) => i === idx ? { ...c, selected: !c.selected } : c))
  }

  function toggleAll(selected: boolean) {
    setContacts(prev => prev.map(c => ({ ...c, selected })))
  }

  async function importContacts() {
    if (!user) return
    setImporting(true)
    const selected = contacts.filter(c => c.selected)
    const batch = `import_${Date.now().toString(36)}`
    let created = 0, duplicates = 0

    for (const c of selected) {
      const phone = c.phone.replace(/\D/g, '')
      // Check for existing lead by phone
      if (phone.length >= 7) {
        const { data: existing } = await supabase.from('leads').select('id').or(`phone.like.%${phone.slice(-7)}%`).limit(1)
        if (existing && existing.length > 0) {
          // Update purchased_products on existing lead if product provided
          if (c.product || defaultProduct) {
            const products = [c.product || defaultProduct].filter(Boolean)
            await supabase.from('leads').update({
              purchased_products: products,
              notes: c.notes ? `${c.notes} (importado ${batchName})` : undefined,
            }).eq('id', existing[0].id)
          }
          duplicates++
          continue
        }
      }

      await supabase.from('leads').insert({
        name: c.name || 'Sin nombre',
        phone: c.phone || '',
        email: c.email || '',
        state: c.state || '',
        insurance_type: c.product || defaultProduct || 'dental',
        purchased_products: [c.product || defaultProduct].filter(Boolean),
        stage: 'new',
        source: 'import',
        import_batch: batch,
        import_source: fileType,
        notes: c.notes || `Importado de ${batchName}`,
        agent_id: user.id,
        account_id: user.account_id,
        score: 30,
      })
      created++
    }

    setImportResult({ total: selected.length, created, duplicates })
    setStep('done')
    setImporting(false)
  }

  const selectedCount = contacts.filter(c => c.selected).length

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Outfit:wght@300;400;500;600;700;800&display=swap');`}</style>
      <div style={{ padding: isMobile ? '24px 16px' : '40px 36px', background: '#06070B', minHeight: '100vh', fontFamily: '"Outfit","Inter",sans-serif', position: 'relative' }}>

        <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(96,165,250,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ marginBottom: '28px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(96,165,250,0.6)', marginBottom: '6px' }}>IMPORTAR</p>
          <h1 style={{ fontFamily: '"DM Serif Display",serif', fontSize: isMobile ? '32px' : '44px', color: '#F0ECE3', margin: 0, lineHeight: 1 }}>Importar Contactos</h1>
          <p style={{ color: 'rgba(240,236,227,0.35)', fontSize: '13px', marginTop: '8px' }}>Sube un archivo con tus contactos y Sophia sabra que producto ofrecerles</p>
        </div>

        {/* ═══ STEP: UPLOAD ═══ */}
        {step === 'upload' && (
          <div style={{ maxWidth: '600px' }}>
            <FileUpload accept=".csv,.xlsx,.xls,.txt" onFile={handleFile} asDataUrl={false}>
              <div style={{
                padding: '60px 40px', borderRadius: '20px', textAlign: 'center',
                background: 'rgba(96,165,250,0.03)', border: '2px dashed rgba(96,165,250,0.2)',
                transition: 'all 0.2s',
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.6 }}>📄</div>
                <p style={{ fontSize: '18px', fontWeight: 600, color: '#F0ECE3', margin: '0 0 8px' }}>Toca para seleccionar archivo</p>
                <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.4)', margin: 0 }}>CSV, Excel (.xlsx), o TXT</p>
                <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.25)', margin: '12px 0 0' }}>Columnas: Nombre, Telefono, Email, Estado, Producto, Notas</p>
              </div>
            </FileUpload>

            {parseError && (
              <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '13px', color: '#fca5a5' }}>{parseError}</div>
            )}

            {/* Format guide */}
            <div style={{ marginTop: '24px', padding: '20px', borderRadius: '16px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <p style={{ fontSize: '12px', fontWeight: 700, color: '#60a5fa', margin: '0 0 12px', letterSpacing: '0.1em' }}>FORMATO DEL ARCHIVO</p>
              <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'rgba(240,236,227,0.5)', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '12px', overflowX: 'auto' }}>
                <div style={{ color: '#60a5fa' }}>nombre, telefono, email, estado, producto, notas</div>
                <div>Juan Perez, +17865551234, juan@email.com, FL, dental, Cliente referido</div>
                <div>Maria Lopez, 3055559876, maria@gmail.com, TX, vida, Interesada en IUL</div>
                <div>Pedro Garcia, 7865554321, , FL, aca, Ya tiene dental</div>
              </div>
              <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.25)', margin: '10px 0 0' }}>La columna "producto" le dice a Sophia que producto YA tiene el cliente, para hacer cross-selling inteligente.</p>
            </div>
          </div>
        )}

        {/* ═══ STEP: PREVIEW ═══ */}
        {step === 'preview' && (
          <div>
            {/* File info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '12px 16px', borderRadius: '12px', background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>📄</span>
                <div>
                  <span style={{ color: '#F0ECE3', fontSize: '14px', fontWeight: 600 }}>{fileName}</span>
                  <span style={{ color: 'rgba(240,236,227,0.4)', fontSize: '12px', marginLeft: '8px' }}>{contacts.length} contactos encontrados</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => toggleAll(true)} style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Todos</button>
                <button onClick={() => toggleAll(false)} style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(240,236,227,0.4)', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' }}>Ninguno</button>
              </div>
            </div>

            {/* Contacts table */}
            <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.04)', marginBottom: '20px' }}>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr 80px 100px', gap: '1px', background: 'rgba(255,255,255,0.06)', padding: '10px 14px', fontSize: '10px', fontWeight: 700, color: 'rgba(240,236,227,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                <span></span><span>Nombre</span><span>Telefono</span><span>Email</span><span>Estado</span><span>Producto</span>
              </div>
              {/* Rows */}
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {contacts.map((c, i) => (
                  <div key={i} onClick={() => toggleContact(i)} style={{
                    display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr 80px 100px', gap: '1px',
                    padding: '10px 14px', cursor: 'pointer', fontSize: '12px',
                    background: c.selected ? 'rgba(52,211,153,0.03)' : 'rgba(255,255,255,0.01)',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    color: c.selected ? '#F0ECE3' : 'rgba(240,236,227,0.3)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{
                        width: '18px', height: '18px', borderRadius: '5px',
                        border: `1.5px solid ${c.selected ? '#34d399' : 'rgba(255,255,255,0.15)'}`,
                        background: c.selected ? '#34d399' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '10px', color: '#06070B',
                      }}>{c.selected ? '✓' : ''}</div>
                    </div>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || '-'}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.phone || '-'}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email || '-'}</span>
                    <span>{c.state || '-'}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.product || '-'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Default product + batch name */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(240,236,227,0.35)', marginBottom: '8px', letterSpacing: '0.1em' }}>PRODUCTO POR DEFECTO (para los que no tengan)</p>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {PRODUCT_TAGS.map(p => (
                    <button key={p.key} onClick={() => setDefaultProduct(defaultProduct === p.key ? '' : p.key)} style={{
                      padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: defaultProduct === p.key ? 700 : 400,
                      background: defaultProduct === p.key ? `${p.color}15` : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${defaultProduct === p.key ? p.color + '40' : 'rgba(255,255,255,0.06)'}`,
                      color: defaultProduct === p.key ? p.color : 'rgba(240,236,227,0.4)',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>{p.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(240,236,227,0.35)', marginBottom: '8px', letterSpacing: '0.1em' }}>NOMBRE DEL LOTE</p>
                <input value={batchName} onChange={e => setBatchName(e.target.value)} placeholder="Ej: Campaña Dental Marzo"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#F0ECE3', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between' }}>
              <button onClick={() => { setStep('upload'); setContacts([]) }} style={{ padding: '12px 24px', borderRadius: '12px', background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(240,236,227,0.4)', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
              <button onClick={importContacts} disabled={importing || selectedCount === 0} style={{
                padding: '12px 32px', borderRadius: '12px', fontSize: '14px', fontWeight: 700, fontFamily: 'inherit',
                background: selectedCount > 0 ? 'linear-gradient(135deg, #34d399, #059669)' : 'rgba(52,211,153,0.2)',
                color: '#06070B', border: 'none', cursor: selectedCount > 0 ? 'pointer' : 'not-allowed',
                boxShadow: selectedCount > 0 ? '0 4px 16px rgba(52,211,153,0.3)' : 'none',
              }}>
                {importing ? 'Importando...' : `Importar ${selectedCount} contactos`}
              </button>
            </div>
          </div>
        )}

        {/* ═══ STEP: DONE ═══ */}
        {step === 'done' && (
          <div style={{ maxWidth: '500px', textAlign: 'center', margin: '40px auto' }}>
            <div style={{ width: '72px', height: '72px', margin: '0 auto 20px', borderRadius: '50%', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>&#10003;</div>
            <h2 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '28px', color: '#F0ECE3', margin: '0 0 16px' }}>Importacion completa</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              <div style={{ padding: '16px', borderRadius: '14px', background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}>
                <p style={{ fontSize: '28px', fontWeight: 800, color: '#34d399', margin: 0 }}>{importResult.created}</p>
                <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.4)', margin: '4px 0 0' }}>Creados</p>
              </div>
              <div style={{ padding: '16px', borderRadius: '14px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
                <p style={{ fontSize: '28px', fontWeight: 800, color: '#fbbf24', margin: 0 }}>{importResult.duplicates}</p>
                <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.4)', margin: '4px 0 0' }}>Duplicados</p>
              </div>
              <div style={{ padding: '16px', borderRadius: '14px', background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)' }}>
                <p style={{ fontSize: '28px', fontWeight: 800, color: '#60a5fa', margin: 0 }}>{importResult.total}</p>
                <p style={{ fontSize: '11px', color: 'rgba(240,236,227,0.4)', margin: '4px 0 0' }}>Total</p>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: 'rgba(240,236,227,0.4)', marginBottom: '24px' }}>
              Los contactos importados estan en tu pipeline como "Nuevos". Sophia sabe que producto tiene cada uno para hacer cross-selling inteligente.
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <a href="/leads" style={{ padding: '12px 28px', borderRadius: '12px', background: 'linear-gradient(135deg, #C9A84C, #A8893A)', color: '#06070B', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>Ver leads &rarr;</a>
              <button onClick={() => { setStep('upload'); setContacts([]); setImportResult({ total: 0, created: 0, duplicates: 0 }) }} style={{ padding: '12px 28px', borderRadius: '12px', background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(240,236,227,0.4)', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>Importar mas</button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
