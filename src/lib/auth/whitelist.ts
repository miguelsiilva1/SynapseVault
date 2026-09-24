export interface WhitelistCheckResult {
  authorized: boolean;
  reason?: string;
}

/**
 * Validates whether an email address belongs to the approved university friend whitelist.
 */
export function isUserAuthorized(email?: string | null): WhitelistCheckResult {
  if (!email) {
    return { authorized: false, reason: 'No email identity found in user session.' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const rawAuthorizedEmails = process.env.AUTHORIZED_EMAILS;
  const rawAuthorizedDomains = process.env.AUTHORIZED_DOMAINS;

  // If no whitelist is configured (e.g. early local dev), allow and warn
  if (!rawAuthorizedEmails && !rawAuthorizedDomains) {
    return { authorized: true };
  }

  // 1. Direct email check
  if (rawAuthorizedEmails) {
    const allowedEmails = rawAuthorizedEmails
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (allowedEmails.includes(normalizedEmail)) {
      return { authorized: true };
    }
  }

  // 2. Academic domain check (e.g., @alunos.fc.up.pt)
  if (rawAuthorizedDomains) {
    const allowedDomains = rawAuthorizedDomains
      .split(',')
      .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
      .filter(Boolean);

    const emailDomain = normalizedEmail.split('@')[1];
    if (emailDomain && allowedDomains.includes(emailDomain)) {
      return { authorized: true };
    }
  }

  return {
    authorized: false,
    reason: `Access denied. Email "${normalizedEmail}" is not in the authorized study group whitelist.`,
  };
}

/**
 * Validates whether an email address belongs to an authorized platform administrator.
 */
export function isUserAdmin(email?: string | null): boolean {
  if (!email) return false;
  const normalizedEmail = email.trim().toLowerCase();
  const rawAdminEmails = process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || '';
  if (!rawAdminEmails) return false;
  const admins = rawAdminEmails
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(normalizedEmail);

}

