/**
 * Applies agent/role scoping to a Supabase query.
 * Admin sees all data. Agents see only their own.
 */
export function scopeQuery(
  query: any,
  user: { id: string; role: string; account_id?: string | null } | null,
  field: string = 'agent_id'
) {
  if (!user) return query
  if (user.role === 'admin') return query
  // Agent sees their own leads
  return query.eq(field, user.id)
}

/**
 * Scope by account_id — for sub-account isolation
 * Admin sees all. Sub-account agents see only their account's data.
 */
export function scopeByAccount(
  query: any,
  user: { id: string; role: string; account_id?: string | null } | null,
) {
  if (!user) return query
  if (user.role === 'admin') return query
  if (user.account_id) return query.eq('account_id', user.account_id)
  return query.eq('agent_id', user.id)
}
