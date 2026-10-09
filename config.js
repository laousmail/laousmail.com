/**
 * Fan signup — real list integration (GitHub Pages safe).
 *
 * Leave `endpoint` empty to show a clear “not connected yet” state.
 * Never put private API keys here.
 *
 * Formspree example:
 *   endpoint: 'https://formspree.io/f/xxxxxxxx'
 *   provider: 'formspree'
 *
 * Buttondown example (public form endpoint):
 *   endpoint: 'https://buttondown.com/api/emails/embed-subscribe/YOUR_USERNAME'
 *   provider: 'buttondown'
 *
 * Custom HTTPS endpoint that accepts POST JSON or form-urlencoded:
 *   endpoint: 'https://your-worker.example.com/subscribe'
 *   provider: 'custom'
 */
window.LAOUSMAIL_FORM = {
  endpoint: '',
  provider: 'formspree',
  /** Optional honeypot field name (leave empty string on the form input named `website`) */
  honeypot: 'website',
}

/**
 * Shared comments backend (Cloudflare Worker + KV).
 * Claim the temporary Worker into your Cloudflare account ASAP
 * (see comments-api/README.md) so the URL stays yours.
 */
window.LAOUSMAIL_COMMENTS_API = {
  endpoint: 'https://laousmail-comments.cubic-device.workers.dev',
  /** Poll interval for new comments from other visitors (ms) */
  pollMs: 20000,
}
