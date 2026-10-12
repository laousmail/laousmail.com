# Comments API (legacy / optional)

Optional Cloudflare Worker used historically for on-site comments. The public site no longer exposes an interactive comment form; reactions on laousmail.com come from curated social exports under `fan-reactions/`.

## Security

- Do not commit Cloudflare claim links, API tokens, account passwords, or `.env` files.
- Do not publish temporary preview claim URLs in this repo.
- Keep Worker credentials and deploy config in your Cloudflare dashboard / local authenticated CLI session, not in public docs.
- Frontend files must never hold write credentials for any comments backend.

If you still maintain this Worker privately, manage deploy and secrets outside the public site docs.
