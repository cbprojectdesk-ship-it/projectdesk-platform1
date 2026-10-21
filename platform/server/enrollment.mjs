// New pilot businesses require an explicit server-side allowlist. Public Site
// access and signing in never grant a workspace or access to another business.
export function mayCreateWorkspace(email, pilotEmails) {
 if (typeof email !== 'string' || typeof pilotEmails !== 'string') return false;
 return pilotEmails.split(',').some(value => value.trim().toLowerCase() === email.toLowerCase());
}
