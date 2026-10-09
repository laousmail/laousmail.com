/**
 * Fan signup — MailerLite (GitHub Pages safe, no API key in the browser).
 *
 * Account: 1893739 (Universal script is loaded on the site).
 *
 * Still needed: an Embedded form subscribe URL.
 * 1. MailerLite → Forms → Embedded → create “Ceux qui écoutent”
 * 2. Copy the form HTML / data-form id, or the action URL:
 *      https://assets.mailerlite.com/jsonp/1893739/forms/FORM_ID/subscribe
 * 3. Paste that URL into `endpoint` below.
 *
 * Never put a private MailerLite API token in this file.
 */
window.LAOUSMAIL_FORM = {
  endpoint: '',
  provider: 'mailerlite',
  accountId: '1893739',
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
