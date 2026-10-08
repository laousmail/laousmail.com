# LAOUSMAIL comments API

Cloudflare Worker + KV backend for shared site comments.

## Endpoints

| Method | Path | Body | Result |
|--------|------|------|--------|
| `GET` | `/` | — | `{ comments: [...] }` |
| `POST` | `/` | `{ handle, text }` | `{ ok: true, comment }` |

## Deploy / claim

**Live URL:** `https://laousmail-comments.island-wasp.workers.dev`

This Worker was first published to a **temporary Cloudflare preview account**.

1. Open [CLAIM.md](./CLAIM.md) and claim the preview account within **60 minutes**.
2. Later deploys:

```bash
cd comments-api
npx wrangler login
npx wrangler deploy
```

Update `config.js` → `LAOUSMAIL_COMMENTS.endpoint` if the Worker URL changes.

## Local

```bash
cd comments-api
npx wrangler dev
```
