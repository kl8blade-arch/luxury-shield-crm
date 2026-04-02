import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// POST - Create a new lead
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      name, phone, email, state, insurance_type, notes, agent_id, account_id,
      city, zip_code, country, gender, marital_status, children, occupation,
      income_range, industry, pain_points, fears, goals, objections, interests,
      referral_source, preferred_language, preferred_contact, budget_range,
      decision_timeline, age,
    } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nombre es requerido' }, { status: 400 })
    }
    if (!agent_id) {
      return NextResponse.json({ error: 'agent_id es requerido' }, { status: 400 })
    }

    const insert: Record<string, any> = {
      name: name.trim(),
      phone: (phone || '').trim(),
      email: email?.trim() || null,
      state: state?.trim() || null,
      insurance_type: insurance_type || 'dental',
      notes: notes?.trim() || null,
      stage: 'new',
      source: 'manual',
      score: 30,
      agent_id,
      account_id: account_id || null,
    }

    // Metadata fields for Sophia learning
    if (city) insert.city = city.trim()
    if (zip_code) insert.zip_code = zip_code.trim()
    if (country) insert.country = country.trim()
    if (gender) insert.gender = gender
    if (marital_status) insert.marital_status = marital_status
    if (children !== undefined && children !== null && children !== '') insert.children = Number(children)
    if (age !== undefined && age !== null && age !== '') insert.age = Number(age)
    if (occupation) insert.occupation = occupation.trim()
    if (income_range) insert.income_range = income_range
    if (industry) insert.industry = industry.trim()
    if (pain_points?.length) insert.pain_points = pain_points
    if (fears?.length) insert.fears = fears
    if (goals?.length) insert.goals = goals
    if (objections?.length) insert.objections = objections
    if (interests?.length) insert.interests = interests
    if (referral_source) insert.referral_source = referral_source.trim()
    if (preferred_language) insert.preferred_language = preferred_language
    if (preferred_contact) insert.preferred_contact = preferred_contact
    if (budget_range) insert.budget_range = budget_range
    if (decision_timeline) insert.decision_timeline = decision_timeline

    const { data, error } = await supabase.from('leads').insert(insert).select().single()

    if (error) {
      console.error('[LEADS API] Insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, lead: data })
  } catch (err: any) {
    console.error('[LEADS API]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET - Export leads as JSON (for Excel/CSV conversion on client)
export async function GET(req: NextRequest) {
  try {
    const agentId = req.nextUrl.searchParams.get('agent_id')
    const accountId = req.nextUrl.searchParams.get('account_id')
    const role = req.nextUrl.searchParams.get('role')
    const format = req.nextUrl.searchParams.get('format') || 'json'

    if (!agentId) {
      return NextResponse.json({ error: 'agent_id requerido' }, { status: 400 })
    }

    let query = supabase.from('leads').select('name, phone, email, state, city, zip_code, country, age, gender, marital_status, children, occupation, income_range, industry, insurance_type, stage, score, source, notes, contact_attempts, last_contact, ready_to_buy, purchased_products, sold_product, sale_date, pain_points, fears, goals, objections, interests, referral_source, preferred_language, preferred_contact, budget_range, decision_timeline, created_at, updated_at').order('created_at', { ascending: false })

    // Scope by account
    if (role === 'admin' && accountId) {
      query = query.or(`account_id.eq.${accountId},account_id.is.null`)
    } else {
      query = query.eq('agent_id', agentId)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (format === 'csv') {
      const leads = data || []
      const headers = [
        'Nombre', 'Telefono', 'Email', 'Estado', 'Ciudad', 'Zip', 'Pais',
        'Edad', 'Genero', 'Estado Civil', 'Hijos', 'Ocupacion', 'Rango Ingreso', 'Industria',
        'Tipo Seguro', 'Etapa', 'Score', 'Fuente', 'Notas',
        'Intentos Contacto', 'Ultimo Contacto', 'Listo Comprar',
        'Productos', 'Producto Vendido', 'Fecha Venta',
        'Pain Points', 'Miedos', 'Objetivos', 'Objeciones', 'Intereses',
        'Referido Por', 'Idioma', 'Contacto Preferido', 'Presupuesto', 'Timeline Decision',
        'Creado', 'Actualizado',
      ]
      const arr = (v: any) => Array.isArray(v) ? v.join('; ') : ''
      const rows = leads.map(l => [
        l.name || '',
        l.phone || '',
        l.email || '',
        l.state || '',
        l.city || '',
        l.zip_code || '',
        l.country || '',
        l.age ?? '',
        l.gender || '',
        l.marital_status || '',
        l.children ?? '',
        l.occupation || '',
        l.income_range || '',
        l.industry || '',
        l.insurance_type || '',
        l.stage || '',
        l.score ?? '',
        l.source || '',
        (l.notes || '').replace(/[\n\r,]/g, ' '),
        l.contact_attempts ?? 0,
        l.last_contact ? new Date(l.last_contact).toLocaleDateString('es-ES') : '',
        l.ready_to_buy ? 'Si' : 'No',
        arr(l.purchased_products),
        l.sold_product || '',
        l.sale_date ? new Date(l.sale_date).toLocaleDateString('es-ES') : '',
        arr(l.pain_points),
        arr(l.fears),
        arr(l.goals),
        arr(l.objections),
        arr(l.interests),
        l.referral_source || '',
        l.preferred_language || '',
        l.preferred_contact || '',
        l.budget_range || '',
        l.decision_timeline || '',
        l.created_at ? new Date(l.created_at).toLocaleDateString('es-ES') : '',
        l.updated_at ? new Date(l.updated_at).toLocaleDateString('es-ES') : '',
      ])

      // BOM for Excel UTF-8 compatibility
      const bom = '\uFEFF'
      const csv = bom + [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="leads_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    return NextResponse.json({ leads: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
