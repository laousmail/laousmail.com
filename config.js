/**
 * Fan signup — MailerLite (GitHub Pages safe, no API key in the browser).
 *
 * Account: 1893739 · Embedded form slug: Mw8lp9
 * Public subscribe uses the numeric form id from MailerLite.
 */
window.LAOUSMAIL_FORM = {
  endpoint: 'https://assets.mailerlite.com/jsonp/1893739/forms/169942944091997773/subscribe',
  provider: 'mailerlite',
  accountId: '1893739',
  formSlug: 'Mw8lp9',
  formId: '169942944091997773',
  /** Optional honeypot field name (leave empty string on the form input named `website`) */
  honeypot: 'website',
}

/**
 * Shared comments backend (Cloudflare Worker + KV).
 * Claim the temporary Worker into your Cloudflare account ASAP
 * (see comments-api/README.md) so the URL stays yours.
 */
window.LAOUSMAIL_COMMENTS_API = {
  endpoint: 'https://laousmail-comments.island-wasp.workers.dev',
  /** Poll interval for new comments from other visitors (ms) */
  pollMs: 20000,
}
