# Claim this comments backend (do this now)

The live Worker is on a **temporary Cloudflare preview account**.

**Claim within 60 minutes of deploy**, or the Worker disappears:

https://dash.cloudflare.com/claim-preview?claimToken=t3obfHMiMkPGBFyeJXs6yLCxAu9ScNnad9kuNE7pXnk

1. Open the link while signed into (or creating) your Cloudflare account.
2. Claim **Roomy Tub** / `laousmail-comments`.
3. Worker URL: `https://laousmail-comments.roomy-tub.workers.dev`  
   (update `config.js` → `LAOUSMAIL_COMMENTS_API.endpoint` if the hostname changes).

Later deploys from this repo:

```bash
cd comments-api
npx wrangler login
npx wrangler deploy
```
