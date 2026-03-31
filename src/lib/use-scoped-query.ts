/**
 * Applies agent/role scoping to a Supabase query.
 * Admin viewing main account sees all.
 * Admin viewing sub-account sees only that account's data.
 * Agent sees only their own.
 */
export function scopeQuery(
  query: any,
  user: { id: string; role: string; account_id?: string | null } | null,
  field: string = 'agent_id',
  activeAccountId?: string | null,
) {
  if (!user) return query
  // Admin viewing a sub-account — scope to that account
  if (user.role === 'admin' && activeAccountId) {
    return query.eq('account_id', activeAccountId)
  }
  // Admin viewing main — sees all
  if (user.role === 'admin') return query
  // Agent sees their own
  return query.eq(field, user.id)
}

/**
 * Scope by account_id — for sub-account isolation
 */
export function scopeByAccount(
  query: any,
  user: { id: string; role: string; account_id?: string | null } | null,
  activeAccountId?: string | null,
) {
  if (!user) return query
  if (user.role === 'admin' && activeAccountId) {
    return query.eq('account_id', activeAccountId)
  }
  if (user.role === 'admin') return query
  if (user.account_id) return query.eq('account_id', user.account_id)
  return query.eq('agent_id', user.id)
}
