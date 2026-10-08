# Claim this comments backend (do this now)

The live Worker is on a **temporary Cloudflare preview account**.

**Claim within 60 minutes of deploy**, or the Worker disappears:

https://dash.cloudflare.com/claim-preview?claimToken=YPi0dtVwM_l8ohHpGtS1Otf7GGe7fDbEof8d9Ll5Qt0

1. Open the link while signed into (or creating) your Cloudflare account.
2. Claim **Island Wasp** / `laousmail-comments`.
3. Worker URL stays: `https://laousmail-comments.island-wasp.workers.dev`  
   (or update `config.js` → `LAOUSMAIL_COMMENTS_API.endpoint` if Cloudflare renames it).

Later deploys from this repo:

```bash
cd comments-api
npx wrangler login
npx wrangler deploy
```
