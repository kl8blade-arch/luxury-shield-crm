import { createClient } from '@supabase/supabase-js'

function prepareTextForSpeech(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/[🎉😊💙🦷📍👨‍👩‍👧🎨⭐💬⚠️📝🎯👋💪📞📅✅❌🔥🛡️👤📱🚀]/gu, '')
    .replace(/\[LISTO_PARA_COMPRAR\]/g, '')
    .replace(/\$/g, ' dólares ')
    .replace(/(\d+)%/g, '$1 por ciento')
    .replace(/DVH/g, 'D V H')
    .replace(/CRM/g, 'C R M')
    .replace(/•/g, ',')
    .replace(/\n\n/g, '. ')
    .replace(/\n/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function generateAndUploadVoice(
  text: string,
  leadPhone: string
): Promise<string | null> {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey || openaiKey === 'pendiente') return null

  try {
    const speechText = prepareTextForSpeech(text)
    const shortText = speechText.length > 400 ? speechText.substring(0, 397) + '...' : speechText

    // Generate audio with OpenAI TTS
    const ttsRes = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice: 'nova',
        input: shortText,
        speed: 0.92,
      }),
    })

    if (!ttsRes.ok) {
      console.error('[Voice] TTS error:', await ttsRes.text())
      return null
    }

    const audioBuffer = Buffer.from(await ttsRes.arrayBuffer())

    // Upload to Supabase Storage
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const fileName = `${leadPhone.replace('+', '')}_${Date.now()}.mp3`

    const { error } = await supabase.storage
      .from('sophia-audio')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: false,
      })

    if (error) {
      console.error('[Voice] Storage upload error:', error)
      return null
    }

    const { data: urlData } = supabase.storage
      .from('sophia-audio')
      .getPublicUrl(fileName)

    console.log(`[Voice] Audio uploaded: ${urlData.publicUrl}`)
    return urlData.publicUrl
  } catch (err) {
    console.error('[Voice] Generation error:', err)
    return null
  }
}

export async function cleanOldAudios(): Promise<number> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: files } = await supabase.storage
      .from('sophia-audio')
      .list('', { limit: 200, sortBy: { column: 'created_at', order: 'asc' } })

    if (!files || files.length === 0) return 0

    const oneHourAgo = Date.now() - 60 * 60 * 1000
    const toDelete = files
      .filter(f => f.created_at && new Date(f.created_at).getTime() < oneHourAgo)
      .map(f => f.name)

    if (toDelete.length > 0) {
      await supabase.storage.from('sophia-audio').remove(toDelete)
      console.log(`[Voice] Cleaned ${toDelete.length} old audio files`)
    }
    return toDelete.length
  } catch (err) {
    console.error('[Voice] Cleanup error:', err)
    return 0
  }
}

// Send WhatsApp media message via Twilio
export async function sendVoiceWhatsApp(to: string, audioUrl: string): Promise<boolean> {
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID!
    const token = process.env.TWILIO_AUTH_TOKEN!
    const from = process.env.TWILIO_WHATSAPP_FROM!
    const cleanTo = to.startsWith('+') ? to : `+${to.replace(/\D/g, '')}`

    const body = new URLSearchParams({
      From: `whatsapp:${from}`,
      To: `whatsapp:${cleanTo}`,
      MediaUrl: audioUrl,
    })

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      }
    )
    const data = await res.json()
    console.log('[Voice] WhatsApp media sent:', data.sid)
    return !data.error_code
  } catch (err) {
    console.error('[Voice] WhatsApp send error:', err)
    return false
  }
}
