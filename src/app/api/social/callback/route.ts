import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const stateParam = req.nextUrl.searchParams.get('state')
  const error = req.nextUrl.searchParams.get('error')
  const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://luxury-shield-crm.vercel.app'
  const redirectUri = `${origin}/api/social/callback`

  if (error) {
    return NextResponse.redirect(`${origin}/social/connect?error=${encodeURIComponent(error)}`)
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(`${origin}/social/connect?error=missing_code`)
  }

  let state: any = {}
  try { state = JSON.parse(Buffer.from(stateParam, 'base64url').toString()) } catch {}

  const platform = state.platform || 'unknown'
  const agentId = state.agentId

  try {
    let tokenData: any = null

    // Exchange code for token based on platform
    if (platform === 'facebook' || platform === 'instagram') {
      const clientId = process.env.FACEBOOK_CLIENT_ID
      const clientSecret = process.env.FACEBOOK_CLIENT_SECRET
      const res = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${clientSecret}&code=${code}`)
      tokenData = await res.json()

      if (tokenData.access_token) {
        // Get long-lived token
        const longRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${tokenData.access_token}`)
        const longData = await longRes.json()
        if (longData.access_token) tokenData = longData

        // Get user profile
        const profileRes = await fetch(`https://graph.facebook.com/me?fields=id,name,picture&access_token=${tokenData.access_token}`)
        const profile = await profileRes.json()
        tokenData.user_id = profile.id
        tokenData.user_name = profile.name
        tokenData.profile_image = profile.picture?.data?.url
      }
    } else if (platform === 'linkedin') {
      const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: process.env.LINKEDIN_CLIENT_ID!, client_secret: process.env.LINKEDIN_CLIENT_SECRET! }),
      })
      tokenData = await res.json()

      if (tokenData.access_token) {
        const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', { headers: { 'Authorization': `Bearer ${tokenData.access_token}` } })
        const profile = await profileRes.json()
        tokenData.user_id = profile.sub
        tokenData.user_name = profile.name
        tokenData.profile_image = profile.picture
      }
    } else if (platform === 'twitter') {
      const res = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${Buffer.from(`${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`).toString('base64')}` },
        body: new URLSearchParams({ code, grant_type: 'authorization_code', redirect_uri: redirectUri, code_verifier: 'challenge' }),
      })
      tokenData = await res.json()

      if (tokenData.access_token) {
        const profileRes = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url', { headers: { 'Authorization': `Bearer ${tokenData.access_token}` } })
        const profile = await profileRes.json()
        tokenData.user_id = profile.data?.id
        tokenData.user_name = profile.data?.username
        tokenData.profile_image = profile.data?.profile_image_url
      }
    } else if (platform === 'tiktok') {
      const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_key: process.env.TIKTOK_CLIENT_ID!, client_secret: process.env.TIKTOK_CLIENT_SECRET!, code, grant_type: 'authorization_code', redirect_uri: redirectUri }),
      })
      tokenData = await res.json()
      if (tokenData.data) tokenData = { ...tokenData, ...tokenData.data }
    } else if (platform === 'youtube') {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: process.env.YOUTUBE_CLIENT_ID!, client_secret: process.env.YOUTUBE_CLIENT_SECRET!, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
      })
      tokenData = await res.json()

      if (tokenData.access_token) {
        const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { 'Authorization': `Bearer ${tokenData.access_token}` } })
        const profile = await profileRes.json()
        tokenData.user_id = profile.id
        tokenData.user_name = profile.name
        tokenData.profile_image = profile.picture
      }
    }

    if (!tokenData?.access_token) {
      console.error(`[SOCIAL] Token exchange failed for ${platform}:`, tokenData)
      return NextResponse.redirect(`${origin}/social/connect?error=token_failed&platform=${platform}`)
    }

    // Save connection to database
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null

    await supabase.from('social_connections').upsert({
      agent_id: agentId || null,
      platform,
      platform_user_id: tokenData.user_id || tokenData.open_id || '',
      platform_username: tokenData.user_name || '',
      platform_name: tokenData.user_name || '',
      profile_image: tokenData.profile_image || '',
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      token_expires_at: expiresAt,
      scopes: tokenData.scope ? tokenData.scope.split(/[, ]+/) : [],
      status: 'active',
      connected_at: new Date().toISOString(),
    }, { onConflict: 'id' })

    return NextResponse.redirect(`${origin}/social/connect?success=true&platform=${platform}`)
  } catch (err: any) {
    console.error(`[SOCIAL] OAuth callback error:`, err)
    return NextResponse.redirect(`${origin}/social/connect?error=${encodeURIComponent(err.message)}&platform=${platform}`)
  }
}
