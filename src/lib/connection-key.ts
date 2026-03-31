const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // No 0,O,I,1 (confusing)

export function generateConnectionKey(): string {
  const segment = () => Array.from({ length: 4 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('')
  return `LSK-${segment()}-${segment()}`
}
