# Email receipt import

Forward an e-receipt to a per-vault address and it files itself into the vault.

```
you forward → <vaultId>@inbound.<yourdomain>
             → mail provider (inbound parse)
             → POST /functions/v1/inbound-email
             → Claude extraction (or heuristic fallback)
             → cloud_receipts (vault_id = <vaultId>)
             → device pulls it on next sync
```

`<vaultId>` is `sha256(vaultKey)` — the same value that scopes the vault in the
cloud. The app shows each device's full import address on the **Cloud backup**
screen ("Email import" section).

## What's already built

- **Edge function `inbound-email`** (deployed, `verify_jwt=false`): parses a
  provider's JSON or `multipart/form-data` webhook, reads the recipient localpart
  as the `vaultId`, extracts the receipt, and upserts into `cloud_receipts`.
  - With `ANTHROPIC_API_KEY` set → Claude reads merchant/total/date/category/items
    from the email text (`source: "ai"`).
  - Without it → a heuristic fallback (largest `$` amount as total, subject/sender
    as merchant, today's date; `source: "heuristic"`).
- **Client**: the import address + copy button on the Cloud backup screen.

## What you must set up (external)

1. **A domain + inbound-email provider.** Options: SendGrid Inbound Parse,
   Postmark inbound, Mailgun routes, or a Cloudflare Email Worker. Add the MX
   records the provider requires for `inbound.<yourdomain>`.
2. **Point the provider's webhook** at:
   ```
   https://diifnystxiwurucolavk.supabase.co/functions/v1/inbound-email?secret=<INBOUND_SECRET>
   ```
   Providers post the parsed email as form fields (`to`, `from`, `subject`,
   `text`/`html`) — the function already reads those.
3. **Set the function secrets** (dashboard → Edge Functions → secrets):
   - `INBOUND_SECRET` — any random string; the provider must include it as
     `?secret=` or an `x-inbound-secret` header. **Required for production** —
     until it's set the function runs in "dev-open" mode and accepts anything.
   - `ANTHROPIC_API_KEY` — enables real AI extraction (shared with
     `extract-receipt` / `claim-helper`).
4. **Set `INBOUND_DOMAIN`** in `lib/config.ts` to your real domain so the app
   shows the correct address.

## Test without a provider

```bash
curl -s -X POST \
  'https://diifnystxiwurucolavk.supabase.co/functions/v1/inbound-email' \
  -H 'content-type: application/json' \
  -d '{"to":"<vaultId>@inbound.example.com","from":"store@shop.com","subject":"Order #1","text":"Total: $36.80"}'
# → {"ok":true,"id":...,"merchant":"Order #1","total":36.8,"source":"heuristic","devOpen":true}
```

Then tap **Sync now** in the app — the receipt appears in the vault.

## Notes / follow-ups

- Anyone who knows a `vaultId` can *write* receipts into that vault (spam), but
  cannot read it (reads require the vault key preimage). Set `INBOUND_SECRET` so
  only your provider can post.
- Attachment (PDF/image) extraction isn't wired yet — extraction runs on the
  email text/HTML. Uploading an attached image to Storage + vision extraction is
  the natural next step.
