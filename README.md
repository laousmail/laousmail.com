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
| `config.js` | Fan signup endpoint (no secrets) |
| `privacy.html` | Short privacy note |

## Local preview

```bash
npx --yes serve .
```

## Fan email list

1. Create a Formspree / Buttondown / similar form endpoint.
2. Set it in `config.js`:

```js
window.LAOUSMAIL_FORM = {
  endpoint: 'https://formspree.io/f/xxxxxxxx',
  provider: 'formspree',
  honeypot: 'website',
}
```

Never put private API keys in frontend files.

Until `endpoint` is set, the form shows a clear “not connected yet” message — it does **not** fake success via localStorage.

## Deploy

GitHub Pages from `main` (root). Custom domain in `CNAME`: `laousmail.com`.

## Update a release

Edit `releases.js` — Music cards and the 15-song orbit update from the same list.
