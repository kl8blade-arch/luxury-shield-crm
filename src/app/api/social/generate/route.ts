import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/token-tracker'

export async function POST(req: NextRequest) {
  try {
    const { product, platform, contentType, tone, agentId, accountId } = await req.json()
    if (!product || !platform || !contentType || !tone) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const nicheContext: Record<string, string> = {
      dental: 'Seguros dentales en USA para la comunidad latina. Pain points: costos altos sin seguro ($800-$2000 emergencias), falta de cobertura del trabajo, familias sin acceso. Productos: planes PPO, HMO, descuento dental. Diferenciadores: $0 primera visita, planes familiares accesibles.',
      iul: 'Indexed Universal Life (IUL) como estrategia de retiro libre de impuestos. Pain points: 401k cobra impuestos al retirar (22-37%), RMDs obligatorios a los 73, sin proteccion de muerte. Ventajas IUL: crece tax-deferred, retiras tax-free, sin RMD, death benefit, piso del 0% en anos malos.',
      aca: 'ACA / Obamacare para familias latinas. Pain points: confunsion sobre elegibilidad, miedo a preguntar por estatus migratorio, costos altos sin subsidio. Realidad: subsidios disponibles hasta $0/mes, periodo de inscripcion abierta, cobertura esencial garantizada.',
      medicare: 'Medicare para latinos de 65+. Pain points: sistema confuso (Part A/B/C/D), costos ocultos, barreras de idioma. Oportunidad: muchos califican y no lo saben, agentes bilingues son escasos, Medicare Advantage con beneficios extras.',
      realtor: 'Bienes raices en USA para compradores y vendedores latinos. Pain points: proceso confuso, barreras de idioma, miedo al credito, downpayment alto. Oportunidad: programas FHA 3.5% down, first-time buyer programs, mercado de inversiones, flipping, wholesale.',
      bienes_raices: 'Bienes raices e inversion inmobiliaria. Pain points: precios altos, tasas de interes, competencia en mercado. Estrategias: house hacking, BRRRR method, AirBnB arbitrage, wholesale, creative financing. Audiencia: latinos buscando su primera casa o inversionistas queriendo cash flow.',
      inversion: 'Inversiones y educacion financiera para latinos en USA. Pain points: no saben por donde empezar, miedo a perder dinero, solo conocen ahorro tradicional. Productos: ETFs, real estate, IUL, Roth IRA, index funds, crypto basics.',
      infoproductos: 'Infoproductos y cursos digitales. Pain points: saturacion del mercado, desconfianza del comprador, dificultad de vender algo intangible. Estrategias: lead magnets gratuitos, webinars, prueba social, transformacion antes/despues, storytelling. Nichos populares: fitness, finanzas, marketing digital, productividad, idiomas, relaciones.',
      dropshipping: 'Dropshipping y e-commerce. Pain points: competencia feroz, margenes bajos, tiempos de envio largos, ADS costosos. Estrategias: nichos micro, TikTok organic, influencer marketing, brand building, private label. Tendencias: print on demand, productos virales, one-product stores, email marketing.',
    }

    const platformGuide: Record<string, string> = {
      facebook: 'Facebook: formato largo permitido, usa emojis moderados, preguntas que generen comentarios, CTAs tipo "comenta X para info", historias personales, groups engagement.',
      instagram: 'Instagram: visual primero, captions cortos y punchy, 5-10 hashtags relevantes, CTAs a DM o link in bio, carruseles educativos, hooks en primera linea.',
      tiktok: 'TikTok: hook en primeros 2 segundos, storytelling rapido, tendencias virales, duets, texto en pantalla, sonidos trending, entre 15-60 segundos.',
      linkedin: 'LinkedIn: tono profesional pero humano, datos y estadisticas, storytelling de negocios, formato con espacios y separadores, CTA sutil, thought leadership.',
      twitter: 'X/Twitter: tweets cortos y directos, hilos para profundizar, datos sorprendentes, hot takes, engagement bait inteligente, maximo 280 chars por tweet.',
      youtube: 'YouTube: titulos clickbait inteligentes, descripciones SEO, thumbnails ideas, scripts para videos 8-15 min, hooks fuertes, CTAs subscribe/like.',
    }

    const contentTypeGuide: Record<string, string> = {
      post: 'Post regular: texto completo, puede incluir emoji, formato legible con saltos de linea.',
      comment: 'Comentario para grupos/posts ajenos: valor primero, NO vender directo, posicionate como experto, maximo 3-4 lineas.',
      story: 'Story: texto corto para superposicion en imagen, maximo 3-4 lineas, incluir sticker/encuesta/pregunta sugerida.',
      reel: 'Reel/Video: incluye HOOK (primeros 2 seg), BODY (contenido valor), CTA (llamada a accion). Formato script.',
      thread: 'Hilo/Thread: 5-8 tweets conectados, cada uno debe funcionar solo pero tambien en secuencia, numera cada tweet.',
      group_post: 'Post para grupo: tono conversacional, pregunta genuina o valor real, NO parecer spam, genera discusion.',
    }

    const toneGuide: Record<string, string> = {
      curiosidad: 'CURIOSIDAD: usa curiosity gap (revela parcialmente), datos sorprendentes, historias incompletas que obligan a preguntar. NO reveles todo, deja el gancho. Ejemplo: "Descubri algo que me cambio X y nunca me lo ensenaron..."',
      educativo: 'EDUCATIVO: comparte conocimiento real y valioso. Tips practicos, datos verificables, comparaciones claras, paso a paso. Posicionate como autoridad. Ejemplo: "3 cosas que nadie te explica sobre X"',
      testimonial: 'TESTIMONIAL: historia en primera persona (ficticia pero 100% realista). Incluye situacion antes, momento de cambio, resultado despues. Emocional pero creible. Ejemplo: "Hace 6 meses estaba en X situacion, hoy Y..."',
      controversial: 'CONTROVERSIAL: cuestiona creencias populares, hot take fundamentado. No insultar, sino abrir los ojos. Ejemplo: "Lo que tu X no te dice sobre Y", "Unpopular opinion: Z"',
      urgencia: 'URGENCIA: deadline real o percibido, escasez, precios subiendo, ventana de oportunidad. Sin ser falso. Ejemplo: "Solo quedan X dias para Y", "Los que actuen antes del Z van a..."',
    }

    const context = nicheContext[product] || `Producto/servicio: ${product}. Genera contenido relevante para este nicho.`
    const platGuide = platformGuide[platform] || platformGuide.facebook
    const typeGuide = contentTypeGuide[contentType] || contentTypeGuide.post
    const tGuide = toneGuide[tone] || toneGuide.curiosidad

    const system = `Eres un experto en marketing digital y copywriting para redes sociales. Tu audiencia principal es la comunidad latina en USA y LATAM. Generas contenido ORIGINAL, nunca repetitivo, siempre adaptado al nicho especifico.

REGLAS ESTRICTAS:
- Genera UN SOLO contenido, listo para copiar y publicar
- NO uses placeholders como [nombre], [producto], etc — escribe contenido FINAL
- Adapta el lenguaje al nicho: si es seguros, habla de seguros. Si es dropshipping, habla de e-commerce. Si es bienes raices, habla de propiedades
- Usa espanglish natural cuando sea apropiado (como hablan los latinos en USA)
- Incluye emojis pero sin exagerar (maximo 5-8 por post)
- El contenido debe generar ENGAGEMENT (likes, comentarios, shares, saves)
- Varia la estructura: a veces empieza con pregunta, a veces con dato, a veces con historia
- NUNCA generes el mismo contenido dos veces — se creativo y unico cada vez
- Al final, sugiere 5-8 hashtags relevantes en una linea separada con prefijo "HASHTAGS:"

${platGuide}
${typeGuide}
${tGuide}`

    const userPrompt = `Genera contenido de ${contentType} para ${platform} sobre: ${product}.

CONTEXTO DEL NICHO:
${context}

TONO: ${tone}

Recuerda: contenido ORIGINAL, especifico para este nicho, listo para publicar. NO repitas formulas genericas.`

    const result = await callAI({
      agentId: agentId || undefined,
      accountId: accountId || undefined,
      feature: 'social_content',
      model: 'claude-haiku-4-5-20251001',
      maxTokens: 800,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    })

    if (!result.text) {
      return NextResponse.json({ error: 'No se pudo generar contenido' }, { status: 500 })
    }

    // Extract hashtags if present
    const lines = result.text.split('\n')
    const hashtagLine = lines.find(l => l.toUpperCase().startsWith('HASHTAGS:'))
    const hashtags = hashtagLine
      ? hashtagLine.replace(/^HASHTAGS:\s*/i, '').split(/\s+/).filter(h => h.startsWith('#'))
      : [`#${product}`, `#${platform}`, '#marketing', '#latinos']
    const contentText = lines.filter(l => !l.toUpperCase().startsWith('HASHTAGS:')).join('\n').trim()

    return NextResponse.json({
      content: contentText,
      hashtags,
      tokens_used: (result.inputTokens || 0) + (result.outputTokens || 0),
    })
  } catch (err: any) {
    console.error('[SOCIAL-GENERATE]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
