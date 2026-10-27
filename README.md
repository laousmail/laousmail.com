# laousmail.com

Artist website for **laousmail** · singer / songwriter · Montréal.

**Live:** https://laousmail.com/

Static HTML / CSS / JS. GitHub Pages from `main`. No build step. No private API keys in frontend files.

## What’s in the repo

| Path | Role |
|------|------|
| `index.html` | Page structure and SEO |
| `site.css` | Design and motion |
| `artist.js` | Language, theme, the orbit (hero player), track list, studio scroll scene, comments wall, signup |
| `releases.js` | Released songs, journey goal, song currently in the studio |
| `fan-reactions/` | Social video comments shown in “What people say” (JSON). `featured: true` entries show first; the rest appear behind the “unfiltered” toggle |
| `config.js` | Public fan signup endpoint only (no secrets) |
| `privacy.html` | Privacy note |

## Local preview

```bash
npx --yes serve .
```

## Updating content

- **New release:** add the track in `releases.js`. The orbit, the hero proof row and the track list update together. When a song comes out, bump `LAOUSMAIL_IN_PRODUCTION` to the next number so the glowing studio node moves on.
- **Song in the studio:** edit `window.LAOUSMAIL_IN_PRODUCTION` in `releases.js` (`step`, `stepProgress`, `note`, `updated`).
- **What people say:** see [`fan-reactions/README.md`](fan-reactions/README.md). Import from your exports, curate `reactions.json`, then commit.

## Fan signup

The “Ceux qui écoutent” form in The show section posts to a public MailerLite subscribe URL set in `config.js`.

- Only use the public embedded-form subscribe endpoint.
- Never put a private MailerLite API token (or any private credential) in this repo or in browser-facing files.

## Deploy

Push to `main`. GitHub Pages serves the site root. Custom domain is set via `CNAME`.
