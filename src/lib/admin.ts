/**
 * Centralized admin check.
 * ADMIN_EMAIL env var supports multiple emails separated by comma.
 */
export function isAdminUser(email: string | null | undefined): boolean {
  if (!email) return false;
  const adminEmails = (process.env.ADMIN_EMAIL || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}
