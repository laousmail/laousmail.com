/**
 * Fan signup — MailerLite (GitHub Pages safe, no API key in the browser).
 *
 * Setup:
 * 1. In MailerLite: Forms → create an Embedded form for “Ceux qui écoutent”.
 * 2. Open the form’s HTML embed / network tab and copy the subscribe action URL:
 *      https://assets.mailerlite.com/jsonp/ACCOUNT_ID/forms/FORM_ID/subscribe
 * 3. Paste that URL into `endpoint` below and keep provider: 'mailerlite'.
 *
 * Never put a private MailerLite API token in this file.
 *
 * Other providers (optional):
 *   Formspree:  endpoint: 'https://formspree.io/f/xxxxxxxx', provider: 'formspree'
 *   Buttondown: endpoint: 'https://buttondown.com/api/emails/embed-subscribe/USER', provider: 'buttondown'
 */
window.LAOUSMAIL_FORM = {
  endpoint: '',
  provider: 'mailerlite',
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
