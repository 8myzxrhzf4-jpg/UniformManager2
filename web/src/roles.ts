/**
 * roles.ts — centralised role definitions and permission helpers.
 *
 * Role hierarchy (highest → lowest):
 *   Super User  – unrestricted access to everything
 *   Admin       – full access to all cities, can manage users & cities
 *   City Admin  – admin powers scoped to their assignedCities only
 *   Staff       – normal operational access to assigned cities
 */

export const ALL_ROLES = ['Staff', 'City Admin', 'Admin', 'Super User'] as const;
export type AppRole = typeof ALL_ROLES[number];

export interface RoleRecord {
  role: AppRole;
  status: 'pending' | 'approved' | 'rejected';
  assignedCities?: string[];   // city keys this user may access / manage
}

// ─── Permission predicates ───────────────────────────────────────────────────

/** Full platform admin — can do everything */
export const isSuperAdmin = (role?: string) => role === 'Super User';

/** Admin or Super User — full cross-city admin */
export const isFullAdmin = (role?: string) =>
  role === 'Admin' || role === 'Super User';

/** City Admin, Admin, or Super User — has some admin capability */
export const isAnyAdmin = (role?: string) =>
  role === 'City Admin' || role === 'Admin' || role === 'Super User';

/**
 * Can this user perform admin actions on a specific city?
 *  - Super User / Admin: yes, always
 *  - City Admin: only if cityKey is in their assignedCities
 *  - Staff: no
 */
export const canAdminCity = (
  role?: string,
  assignedCities?: string[],
  cityKey?: string
): boolean => {
  if (isFullAdmin(role)) return true;
  if (role === 'City Admin' && cityKey) {
    return (assignedCities || []).includes(cityKey);
  }
  return false;
};

/** Can the user see all cities regardless of assignment? */
export const canSeeAllCities = (role?: string) => isFullAdmin(role);

/** Role display label with a badge colour hint */
export const roleMeta: Record<AppRole, { label: string; color: string }> = {
  'Super User': { label: 'Super User', color: '#f59e0b' },
  'Admin':      { label: 'Admin',      color: '#6366f1' },
  'City Admin': { label: 'City Admin', color: '#10b981' },
  'Staff':      { label: 'Staff',      color: '#6b7280' },
};
