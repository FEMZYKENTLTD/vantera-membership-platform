/**
 * Static brand configuration. Business-editable content (contact details,
 * payment configuration, notices) lives in the site_settings table and is
 * administered from /admin/settings — not hard-coded here.
 */

export const site = {
  name: 'Vantera',
  wordmark: 'VANTERA',
  tagline: 'A private circle, issued to a few.',
  description:
    'Vantera is a luxury membership brand. Approved members receive a personalised Vantera membership card.',
  emailVerificationNotice:
    'For your security, we may ask you to verify your email address before you can access your member portal.'
} as const;

/** Canonical list of public navigation items. */
export const publicNav = [
  { href: '/membership', label: 'Membership' },
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' }
] as const;
