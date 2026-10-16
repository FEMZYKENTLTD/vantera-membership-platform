/**
 * Centralised environment access with validation.
 * Server-only secrets are never read from client modules.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example.`
    );
  }
  return value;
}

export const env = {
  supabaseUrl: () =>
    required(
      'NEXT_PUBLIC_SUPABASE_URL',
      process.env.NEXT_PUBLIC_SUPABASE_URL
    ),
  supabaseAnonKey: () =>
    required(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ),
  /** SERVER ONLY — never import from client components. */
  supabaseServiceRoleKey: () =>
    required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY),
  siteUrl: () =>
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000',
  emailProvider: () => process.env.EMAIL_PROVIDER ?? '',
  emailFrom: () => process.env.EMAIL_FROM ?? '',
  resendApiKey: () => process.env.RESEND_API_KEY ?? '',
  contactInbox: () => process.env.CONTACT_INBOX ?? ''
};

/** True when a transactional email provider is fully configured. */
export function emailConfigured(): boolean {
  return (
    env.emailProvider() === 'resend' &&
    env.resendApiKey().length > 0 &&
    env.emailFrom().length > 0
  );
}
