# Fan Reactions

Comments under LAOUSMAIL videos on Instagram / TikTok, shown on [laousmail.com](https://laousmail.com).

They are **unfiltered social comments**. Visitors **cannot** leave a comment on the site.

No paid APIs, databases, or scraping. The site loads `fan-reactions/reactions.json` only.

## Files

| Path | Role |
|------|------|
| `source/` | Raw exports (CSV/JSON). Keep originals here; do not edit for display. |
| `reactions.json` | **Source of truth for the live section.** Curate this file. |
| `reactions.sample.json` | Empty sample showing the shape (no invented testimonials). |
| `schema.json` | JSON Schema for each reaction record. |
| `../scripts/import-fan-reactions.mjs` | Import / normalize helper. |
| `../avatars/` | Optional local profile images you choose to host. |

## Data shape

Each reaction:

- `id` (string, required)
- `platform` (`instagram` \| `tiktok`, required)
- `username` (string, required)
- `displayName` (optional)
- `profileImageUrl` (optional HTTPS URL **or** relative `avatars/…` path)
- `commentText` (string, required, plain text)
- `postUrl` (optional HTTPS link to the original public post)
- `createdAt` (optional ISO date)
- `featured` (boolean)

## Import workflow

1. Export comments from Instagram or TikTok (official tools or your usual exporter).
2. Drop the file into `fan-reactions/source/`.
3. Run:

```bash
# Instagram CSV (column names are normalized automatically)
node scripts/import-fan-reactions.mjs \
  --input fan-reactions/source/instagram-export.csv \
  --platform instagram

# Prefer local avatars/ files when you have permission to host them
node scripts/import-fan-reactions.mjs \
  --input fan-reactions/source/instagram-export.csv \
  --platform instagram \
  --prefer-local-avatars \
  --merge
```

4. Open `reactions.json` and **curate**:
   - Set `featured: true` on moments you want highlighted
   - Reorder the array (featured strip prefers `featured`, then keeps order)
   - Remove anything that should not be public
   - Add `postUrl` when you have a real permalink (never invent one)
   - Replace expired remote `profileImageUrl` with a permitted local `avatars/…` path, or set it to `null`

5. Commit and deploy (GitHub Pages picks up static files on `main`).

### Merge behaviour

`--merge` keeps existing `featured` flags and manual fields when the same `id` appears again, while refreshing text/media from the new export.

## Profile photos

- Use URLs only when they come from a legitimate export.
- Remote Instagram/TikTok CDN URLs **expire**. Prefer permitted local assets under `avatars/` for anything you want to stay stable.
- Do not invent profile image URLs.
- Missing or broken images fall back to an initial avatar in the UI.
- Only host someone’s photo if you have appropriate permission for public display.

## Privacy

- Show only comments you select for public presentation.
- Do not publish private messages, private-account data, or deleted content.
- Comment text is rendered as plain text (never HTML).
- External links use `target="_blank"` and `rel="noopener noreferrer"`.

## Empty state

If `reactions` is `[]` or the JSON fails to load, the section hides itself so the rest of the site is unchanged.
