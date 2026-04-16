// src/lib/sophia-knowledge.ts
export async function getRelevantKnowledge(
  message: string,
  accountId: string
): Promise<string> {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://luxury-shield-crm.vercel.app'
    const r = await fetch(`${appUrl}/api/sophia/knowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, accountId }),
    })
    if (!r.ok) return ''
    const { knowledge } = await r.json()
    return knowledge ?? ''
  } catch {
    return ''
  }
}
