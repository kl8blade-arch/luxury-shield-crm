import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateConnectionKey } from '@/lib/connection-key'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/**
 * GET — List linked accounts for an account
 */
export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get('account_id')
  if (!accountId) return NextResponse.json({ error: 'account_id requerido' }, { status: 400 })

  // Accounts I manage (I have access to)
  const { data: managing } = await supabase.from('linked_accounts')
    .select('*, owner:accounts!owner_account_id(id, name, slug, logo_url, industry)')
    .eq('linked_account_id', accountId).eq('status', 'active')

  // Accounts that manage me (have access to my account)
  const { data: managedBy } = await supabase.from('linked_accounts')
    .select('*, linked:accounts!linked_account_id(id, name, slug)')
    .eq('owner_account_id', accountId)

  // Pending keys (generated but not connected yet)
  const { data: pending } = await supabase.from('linked_accounts')
    .select('*').eq('owner_account_id', accountId).eq('status', 'pending')

  return NextResponse.json({ managing: managing || [], managedBy: managedBy || [], pending: pending || [] })
}

/**
 * POST — Generate key, connect, or revoke
 */
export async function POST(req: NextRequest) {
  const { action, accountId, connectionKey, permissions, label } = await req.json()

  // Generate a new connection key
  if (action === 'generate') {
    if (!accountId) return NextResponse.json({ error: 'accountId requerido' }, { status: 400 })
    const key = generateConnectionKey()

    await supabase.from('linked_accounts').insert({
      owner_account_id: accountId,
      connection_key: key,
      label: label || null,
      permissions: permissions || {},
      status: 'pending',
    })

    return NextResponse.json({ key, message: 'Comparte esta clave con quien administrara tu cuenta.' })
  }

  // Connect using a key
  if (action === 'connect') {
    if (!accountId || !connectionKey) return NextResponse.json({ error: 'accountId y connectionKey requeridos' }, { status: 400 })

    const { data: link } = await supabase.from('linked_accounts')
      .select('*, owner:accounts!owner_account_id(id, name, slug, logo_url)')
      .eq('connection_key', connectionKey.trim().toUpperCase()).eq('status', 'pending').single()

    if (!link) return NextResponse.json({ error: 'Clave invalida, ya usada, o revocada.' }, { status: 404 })

    // Can't connect to own account
    if (link.owner_account_id === accountId) {
      return NextResponse.json({ error: 'No puedes vincular tu propia cuenta.' }, { status: 400 })
    }

    await supabase.from('linked_accounts').update({
      linked_account_id: accountId,
      status: 'active',
      connected_at: new Date().toISOString(),
    }).eq('id', link.id)

    // Audit
    await supabase.from('linked_account_audit').insert({
      actor_account_id: accountId,
      target_account_id: link.owner_account_id,
      action: 'connected',
      metadata: { connection_key: connectionKey },
    })

    return NextResponse.json({
      connected: true,
      account: link.owner,
      permissions: link.permissions,
    })
  }

  // Revoke access
  if (action === 'revoke') {
    const linkId = req.nextUrl.searchParams.get('id') || (await req.json().catch(() => ({}))).linkId
    const { data } = await supabase.from('linked_accounts').update({ status: 'revoked' }).eq('id', linkId || '').select().single()

    if (data) {
      await supabase.from('linked_account_audit').insert({
        actor_account_id: accountId,
        target_account_id: data.owner_account_id,
        action: 'revoked',
      })
    }

    return NextResponse.json({ revoked: true })
  }

  return NextResponse.json({ error: 'Accion no valida' }, { status: 400 })
}
