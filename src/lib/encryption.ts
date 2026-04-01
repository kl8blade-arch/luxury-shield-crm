import { createCipheriv, createDecipheriv, randomBytes, createHmac } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

/**
 * Derive a unique key per tenant using HKDF-like approach:
 * masterKey + tenantId → SHA256 → unique 32-byte key
 * This way, even if DB is stolen, each tenant's keys are different.
 */
function deriveKey(tenantId?: string): Buffer {
  const hex = process.env.ENCRYPTION_MASTER_KEY
  if (!hex) throw new Error('ENCRYPTION_MASTER_KEY not set')
  const masterKey = Buffer.from(hex, 'hex')

  if (!tenantId) return masterKey // Fallback for global

  // HKDF-like: HMAC-SHA256(masterKey, tenantId) → 32 bytes
  return createHmac('sha256', masterKey).update(tenantId).digest()
}

export function encryptApiKey(plaintext: string, tenantId?: string): { encrypted: string; iv: string; tag: string } {
  const key = deriveKey(tenantId)
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const tag = (cipher as any).getAuthTag().toString('hex')
  return { encrypted, iv: iv.toString('hex'), tag }
}

export function decryptApiKey(encrypted: string, iv: string, tag: string, tenantId?: string): string {
  const key = deriveKey(tenantId)
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'))
  ;(decipher as any).setAuthTag(Buffer.from(tag, 'hex'))
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}
