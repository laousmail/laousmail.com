# laousmail.com

Artist website for **LAOUSMAIL** — singer / songwriter · Montréal.

This is **not** a studio or services site. No pricing, no “work with me”, no EclipseTone business funnel.

**Live:** https://laousmail.com/

## Stack

Static HTML / CSS / JS. GitHub Pages compatible. No build step.

| File | Role |
|------|------|
| `index.html` | Page structure |
| `site.css` | Design + motion |
| `artist.js` | Lang, theme, menu, releases render, form |
| `releases.js` | Song + journey data (edit here to add releases) |
| `comments.js` | Live TikTok-style comments (paste more anytime) |
| `fan-reactions.js` | Editorial Fan Reactions section |
| `fan-reactions/` | Curated JSON dataset, schema, import docs |
| `config.js` | Fan signup endpoint (no secrets) |
| `privacy.html` | Short privacy note |

## Comments backend + Spotify preview

- Comments rail posts to a **Cloudflare Worker + KV** API (`comments-api/`). Shared across visitors.
- Config: `config.js` → `LAOUSMAIL_COMMENTS_API.endpoint`.
- Seed/fallback list still lives in `comments.js` if the API is briefly unreachable.
- **Claim the temporary Worker** — see `comments-api/CLAIM.md` (time-limited).
- First click on a song opens a popup with the 30s preview, then **Spotify / YouTube / Apple Music**.
- Links + preview URLs live in `releases.js`.

## Fan Reactions

Curated Instagram / TikTok comments (local JSON only). See [`fan-reactions/README.md`](fan-reactions/README.md).

```bash
node scripts/import-fan-reactions.mjs \
  --input fan-reactions/source/instagram-export.csv \
  --platform instagram \
  --prefer-local-avatars
```

## Local preview

```bash
npx --yes serve .
```

## Fan email list (MailerLite)

1. In MailerLite, create an **Embedded form** for the list (e.g. “Ceux qui écoutent”).
2. Copy the form’s public subscribe URL (looks like):
   `https://assets.mailerlite.com/jsonp/ACCOUNT_ID/forms/FORM_ID/subscribe`
3. Set it in `config.js`:

```js
window.LAOUSMAIL_FORM = {
  endpoint: 'https://assets.mailerlite.com/jsonp/ACCOUNT_ID/forms/FORM_ID/subscribe',
  provider: 'mailerlite',
  honeypot: 'website',
}
```

Never put a private MailerLite API token in frontend files.

Until `endpoint` is set, the form shows a clear “not connected yet” message — it does **not** fake success via localStorage.

## Deploy

GitHub Pages from `main` (root). Custom domain in `CNAME`: `laousmail.com`.

## Update a release

Edit `releases.js` — Music cards and the 15-song orbit update from the same list.

## Update the song in the studio

Edit `window.LAOUSMAIL_IN_PRODUCTION` in `releases.js`:

```js
step: 'recording',       // writing | recording | mixing | mastering
stepProgress: 0.55,      // 0–1 inside the current step
note: { en: '...', fr: '...' },
updated: '2026-10-09',
```
