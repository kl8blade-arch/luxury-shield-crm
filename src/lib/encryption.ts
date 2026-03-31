import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32

function getMasterKey(): Buffer {
  const hex = process.env.ENCRYPTION_MASTER_KEY
  if (!hex) throw new Error('ENCRYPTION_MASTER_KEY not set')
  return Buffer.from(hex, 'hex')
}

export function encryptApiKey(plaintext: string): { encrypted: string; iv: string; tag: string } {
  const key = getMasterKey()
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const tag = (cipher as any).getAuthTag().toString('hex')
  return { encrypted, iv: iv.toString('hex'), tag }
}

export function decryptApiKey(encrypted: string, iv: string, tag: string): string {
  const key = getMasterKey()
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'))
  ;(decipher as any).setAuthTag(Buffer.from(tag, 'hex'))
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}
