import { NextRequest, NextResponse } from 'next/server'

// OAuth URLs for each platform
const OAUTH_CONFIGS: Record<string, { authUrl: string; scopes: string }> = {
  facebook: {
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    scopes: 'pages_manage_posts,pages_read_engagement,pages_show_list,pages_messaging,instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_messages',
  },
  instagram: {
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth', // Instagram uses FB OAuth
    scopes: 'instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_messages,pages_show_list',
  },
  tiktok: {
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    scopes: 'user.info.basic,video.publish,video.list',
  },
  linkedin: {
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    scopes: 'openid profile email w_member_social',
  },
  twitter: {
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    scopes: 'tweet.read tweet.write users.read offline.access',
  },
  youtube: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scopes: 'https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.force-ssl',
  },
}

export async function POST(req: NextRequest) {
  try {
    const { platform, agentId } = await req.json()

    if (!platform || !OAUTH_CONFIGS[platform]) {
      return NextResponse.json({ error: 'Plataforma no soportada' }, { status: 400 })
    }

    const config = OAUTH_CONFIGS[platform]
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://luxury-shield-crm.vercel.app'
    const redirectUri = `${origin}/api/social/callback`

    // Build the env var names we need
    const clientIdKey = `${platform.toUpperCase()}_CLIENT_ID`
    const clientId = process.env[clientIdKey]

    if (!clientId) {
      return NextResponse.json({
        error: `${platform} no esta configurado. Agrega ${clientIdKey} en las variables de entorno de Vercel.`,
        setup_needed: true,
        instructions: getSetupInstructions(platform),
      }, { status: 503 })
    }

    // State param for security (includes platform + agentId)
    const state = Buffer.from(JSON.stringify({ platform, agentId, ts: Date.now() })).toString('base64url')

    let authUrl = ''
    if (platform === 'facebook' || platform === 'instagram') {
      authUrl = `${config.authUrl}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(config.scopes)}&response_type=code&state=${state}`
    } else if (platform === 'tiktok') {
      authUrl = `${config.authUrl}?client_key=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(config.scopes)}&response_type=code&state=${state}`
    } else if (platform === 'linkedin') {
      authUrl = `${config.authUrl}?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(config.scopes)}&state=${state}`
    } else if (platform === 'twitter') {
      authUrl = `${config.authUrl}?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(config.scopes)}&state=${state}&code_challenge=challenge&code_challenge_method=plain`
    } else if (platform === 'youtube') {
      authUrl = `${config.authUrl}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(config.scopes)}&response_type=code&state=${state}&access_type=offline&prompt=consent`
    }

    return NextResponse.json({ authUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function getSetupInstructions(platform: string): string {
  const instructions: Record<string, string> = {
    facebook: '1. Ve a developers.facebook.com\n2. Crea una App tipo "Business"\n3. Agrega Facebook Login + Instagram\n4. Copia App ID → FACEBOOK_CLIENT_ID\n5. Copia App Secret → FACEBOOK_CLIENT_SECRET',
    instagram: 'Instagram usa la misma app de Facebook.\n1. Ve a developers.facebook.com\n2. En tu app, activa Instagram Basic Display\n3. Usa FACEBOOK_CLIENT_ID y FACEBOOK_CLIENT_SECRET',
    tiktok: '1. Ve a developers.tiktok.com\n2. Crea una app\n3. Activa "Login Kit" y "Content Posting API"\n4. Copia Client Key → TIKTOK_CLIENT_ID\n5. Copia Client Secret → TIKTOK_CLIENT_SECRET',
    linkedin: '1. Ve a linkedin.com/developers\n2. Crea una app\n3. Activa "Sign In with LinkedIn" y "Share on LinkedIn"\n4. Copia Client ID → LINKEDIN_CLIENT_ID\n5. Copia Client Secret → LINKEDIN_CLIENT_SECRET',
    twitter: '1. Ve a developer.twitter.com\n2. Crea un proyecto + app\n3. Activa OAuth 2.0\n4. Copia Client ID → TWITTER_CLIENT_ID\n5. Copia Client Secret → TWITTER_CLIENT_SECRET',
    youtube: '1. Ve a console.cloud.google.com\n2. Crea proyecto y activa YouTube Data API v3\n3. Crea credenciales OAuth\n4. Copia Client ID → YOUTUBE_CLIENT_ID\n5. Copia Client Secret → YOUTUBE_CLIENT_SECRET',
  }
  return instructions[platform] || ''
}
