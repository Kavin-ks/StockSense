/**
 * Single source of truth for what each role may do.
 * The API enforces it (requirePermission / assertCan) and /auth/me sends the
 * resolved list to the UI, so buttons are hidden with exactly the same rules.
 *
 * Mapping to the problem statement:
 *   Inventory Managers – manage incoming & outgoing stock  -> plan/cancel receipts & deliveries,
 *                        products, settings, users
 *   Warehouse Staff    – transfers, picking, shelving, counting -> run transfers and adjustments,
 *                        and *process* receipts (shelving) and deliveries (picking) planned by a manager
 */
export const ROLES = ['manager', 'staff'];

const MANAGER = ['manager'];
const EVERYONE = ['manager', 'staff'];

const PERMISSIONS = {
  'products.write': MANAGER,      // products, categories, reorder rules
  'settings.write': MANAGER,      // warehouses & locations
  'users.manage': MANAGER,
  'receipt.manage': MANAGER,      // create / edit / cancel
  'receipt.process': EVERYONE,    // To Do + Validate (goods physically received & shelved)
  'delivery.manage': MANAGER,
  'delivery.process': EVERYONE,   // To Do + Validate (goods picked & shipped)
  'internal.manage': EVERYONE,
  'internal.process': EVERYONE,
  'adjustment.manage': EVERYONE,  // physical counts
};

export const can = (role, permission) => PERMISSIONS[permission]?.includes(role) ?? false;
export const permissionsFor = (role) => Object.keys(PERMISSIONS).filter((p) => can(role, p));
