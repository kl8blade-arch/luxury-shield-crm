import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Called from WhatsApp or CRM to build a landing step by step
export async function POST(req: NextRequest) {
  try {
    const { build_id, answer, photo_url } = await req.json()

    if (!build_id) return NextResponse.json({ error: 'build_id required' }, { status: 400 })

    const { data: build } = await supabase.from('landing_builds').select('*, landing_templates(*)').eq('id', build_id).single()
    if (!build) return NextResponse.json({ error: 'Build not found' }, { status: 404 })

    const template = build.landing_templates as any
    const variables = template?.variables || []
    const collected = build.collected_data || {}
    const currentQ = build.current_question || 0

    // Save answer to current question
    if (answer || photo_url) {
      const currentVar = variables[currentQ]
      if (currentVar) {
        if (photo_url) {
          const photos = build.photos || []
          photos.push({ key: currentVar.key, url: photo_url })
          collected[currentVar.key] = photo_url
          await supabase.from('landing_builds').update({ collected_data: collected, photos, current_question: currentQ + 1, updated_at: new Date().toISOString() }).eq('id', build_id)
        } else {
          collected[currentVar.key] = answer
          await supabase.from('landing_builds').update({ collected_data: collected, current_question: currentQ + 1, updated_at: new Date().toISOString() }).eq('id', build_id)
        }
      }
    }

    const nextQ = currentQ + (answer || photo_url ? 1 : 0)

    // Check if all questions answered
    if (nextQ >= variables.length) {
      // Generate the landing page with Claude
      const html = await generateLandingHTML(template, collected)
      const slug = `${collected.agency_name || 'landing'}`.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString(36)

      await supabase.from('landing_builds').update({
        status: 'ready', generated_html: html, slug, updated_at: new Date().toISOString(),
      }).eq('id', build_id)

      return NextResponse.json({
        status: 'complete',
        message: '¡Tu landing page está lista!',
        url: `/l/${slug}`,
        slug,
      })
    }

    // Return next question
    const nextVar = variables[nextQ]
    const isPhoto = nextVar?.type === 'photo'

    return NextResponse.json({
      status: 'collecting',
      question_number: nextQ + 1,
      total_questions: variables.length,
      question: nextVar?.label || 'Siguiente dato',
      type: nextVar?.type || 'text',
      is_photo: isPhoto,
      message: isPhoto
        ? `📸 ${nextVar.label}\nEnvíame una foto o imagen para tu landing.`
        : `✏️ ${nextVar.label}`,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function generateLandingHTML(template: any, data: any): Promise<string> {
  try {
    const { callAI } = await import('@/lib/token-tracker')
    const result = await callAI({
      feature: 'landing_builder', model: 'claude-haiku-4-5-20251001', maxTokens: 4000,
      messages: [{ role: 'user', content: `Genera una landing page HTML completa, profesional y moderna para un agente de seguros.
Categoría: ${template.category}
Template: ${template.name}

DATOS DEL AGENTE:
${JSON.stringify(data, null, 2)}

REGLAS:
- HTML completo con <html>, <head>, <style>, <body>
- Diseño dark luxury con el color principal: ${data.primary_color || '#C9A84C'}
- Mobile responsive
- Formulario de contacto con nombre, teléfono, estado, edad
- Botón de WhatsApp que abre: https://wa.me/${(data.agent_phone || '').replace(/\D/g, '')}
- Si hay foto del agente, mostrarla como avatar circular
- Si hay logo, mostrarlo en el header
- Testimonios si los hay
- Footer con disclaimer de seguro
- Fuentes: Google Fonts (Outfit + DM Serif Display)
- NO usar JavaScript externo, solo CSS puro + formulario
- Formulario envía a: https://luxury-shield-crm.vercel.app/api/save-lead
- El formulario debe incluir campo oculto: fuente=landing_${template.category}

Devuelve SOLO el HTML completo, sin explicaciones ni backticks.` }],
    })

    let html = result.text || ''
    html = html.replace(/```html\n?|\n?```/g, '').trim()
    if (html) return html
    return '<html><body><h1>Landing en construccion</h1></body></html>'
  } catch {
    return '<html><body><h1>Landing en construcción</h1></body></html>'
  }
}

// Start a new build
export async function PUT(req: NextRequest) {
  try {
    const { template_id, agent_phone } = await req.json()
    if (!template_id) return NextResponse.json({ error: 'template_id required' }, { status: 400 })

    const { data: template } = await supabase.from('landing_templates').select('*').eq('id', template_id).single()
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

    const { data: build } = await supabase.from('landing_builds').insert({
      template_id, agent_phone, status: 'collecting_info', current_question: 0,
    }).select().single()

    const variables = template.variables as any[]
    const firstVar = variables?.[0]

    return NextResponse.json({
      build_id: build?.id,
      status: 'started',
      template_name: template.name,
      total_questions: variables?.length || 0,
      first_question: firstVar?.label || 'Nombre de tu agencia',
      first_type: firstVar?.type || 'text',
      message: `🌐 ¡Vamos a crear tu landing page "${template.name}"!\n\nTe haré ${variables?.length || 0} preguntas rápidas.\n\n✏️ Primero: ${firstVar?.label || 'Nombre de tu agencia'}`,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
