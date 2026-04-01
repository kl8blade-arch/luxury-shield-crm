/**
 * Applies agent/role scoping to a Supabase query.
 * Admin viewing sub-account → scope to that account.
 * Admin viewing own dashboard → scope to admin's own account.
 * Agent → scope to their own data.
 */
export function scopeQuery(
  query: any,
  user: { id: string; role: string; account_id?: string | null } | null,
  field: string = 'agent_id',
  activeAccountId?: string | null,
) {
  if (!user) return query
  // Admin viewing a specific sub/linked account
  if (user.role === 'admin' && activeAccountId) {
    return query.eq('account_id', activeAccountId)
  }
  // Admin viewing own dashboard — scope to OWN account (not all accounts)
  if (user.role === 'admin' && user.account_id) {
    return query.eq('account_id', user.account_id)
  }
  // Agent sees their own
  return query.eq(field, user.id)
}

/**
 * Scope by account_id
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
  if (user.account_id) return query.eq('account_id', user.account_id)
  return query.eq('agent_id', user.id)
}
