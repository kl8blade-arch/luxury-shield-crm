import { supabase } from './supabase'

/**
 * Applies agent/role scoping to a Supabase query.
 * Admin sees all data. Agents see only their own.
 */
export function scopeQuery(
  query: any,
  user: { id: string; role: string } | null,
  field: string = 'agent_id'
) {
  if (!user) return query
  if (user.role === 'admin') return query
  return query.eq(field, user.id)
}
