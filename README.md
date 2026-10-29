# laousmail.com

Artist website for **laousmail** · singer / songwriter · Montréal.

**Live:** https://laousmail.com/

Static HTML / CSS / JS on GitHub Pages, published from `main` by `.github/workflows/pages.yml`
(which also minifies the scripts and styles in the published copy). No private keys in any file.

## What's in the repo

| Path | Role |
|------|------|
| `index.html` | The page: content, SEO, security rules |
| `releases.js` | **The file you edit**: released songs, the 15-song goal, the song in the studio |
| `artist.js` | Language, theme, the orbit and its player, song list, studio progress, countdown, sign-up |
| `journey.js` · `journey.css` | The journey: the orbit stays on screen and becomes each card as you scroll |
| `field.js` | The living background (embers, sparks, ripples, the ring of ticks) |
| `site.css` · `orbit.css` | Base design, then the ORBIT look on top |
| `fonts.css` · `fonts/` | The three fonts, served from this site |
| `stats.js` | Anonymous visit counts (Umami, no cookies) |
| `config.js` | Public MailerLite sign-up address only |
| `play/` | ORBIT Studio, the playable (linked from the menu only) |
| `privacy.html` | Privacy note |
| `media/` | Photos and covers |

## Updating content

- **Song in the studio:** edit `window.LAOUSMAIL_IN_PRODUCTION` in `releases.js` (`step`, `stepProgress`, `note`, `updated`).
  The studio card, the orbit and the status line follow.
- **New release:** add it to `window.LAOUSMAIL_RELEASES` in `releases.js`, then move `LAOUSMAIL_IN_PRODUCTION`
  to the next number. The song gets its own card and dot.

## Local preview

```bash
python3 -m http.server 8000
```

## Your own visits

Open `https://laousmail.com/?stats=off` once on each of your devices so your visits aren't counted
(`?stats=on` to count them again).

## Sign-up

The Ceux qui écoutent form posts to the public MailerLite subscribe address in `config.js`.
Never put a private MailerLite API token (or any private credential) in this repo.
