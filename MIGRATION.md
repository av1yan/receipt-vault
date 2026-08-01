# Migrating to a dedicated Supabase project

Receipt Vault currently points at a **shared** Supabase project (`diifnystxiwurucolavk`, the "Habit Tracker" project — see the note in `lib/config.ts`). Before real users, move it to its own project so your data, auth, and security posture are isolated. This is the runnable plan.

> The existing cloud data is dev/test only — this plan **starts the new project fresh** rather than migrating rows. If you have real data to keep, export `cloud_receipts` / `rv_user_vaults` and the `receipts` bucket first.

---

## 1. Create the project

Dashboard → **New project** (pick an org + region close to your users). Note the new **Project URL** and **anon (publishable) key** from Settings → API.

---

## 2. Schema (SQL editor → run once)

```sql
-- Cloud receipts (scoped by sha256(vaultKey)). RLS ON with NO policies: only the
-- service-role `sync` edge function may touch it.
create table if not exists public.cloud_receipts (
  vault_id          text             not null,
  id                bigint           not null,
  merchant          text             not null,
  cat               text             not null,
  date              bigint           not null,
  total             double precision not null,
  pay               text             not null,
  ret               integer          not null,
  war               integer          not null,
  image_uri         text,
  items             jsonb            not null default '[]'::jsonb,
  updated_at        timestamptz      not null default now(),
  has_photo         boolean          not null default false,
  status            text,
  status_kind       text,
  status_at         bigint,
  reimbursable      boolean          default false,
  deleted           boolean          not null default false,
  client_updated_at bigint           not null default 0,
  primary key (vault_id, id)
);
alter table public.cloud_receipts enable row level security;   -- no policies on purpose

-- Per-account vault key (accounts feature). RLS: a user sees only their own row.
create table if not exists public.rv_user_vaults (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  vault_key  text not null,
  created_at timestamptz not null default now()
);
alter table public.rv_user_vaults enable row level security;
create policy "own vault select" on public.rv_user_vaults for select using (auth.uid() = user_id);
create policy "own vault insert" on public.rv_user_vaults for insert with check (auth.uid() = user_id);

-- Conditional upsert used by the sync edge function (last-writer-wins by edit time).
create or replace function public.sync_receipts(p_vault text, p_rows jsonb)
returns void language plpgsql set search_path to 'public' as $$
begin
  insert into public.cloud_receipts as cr
    (vault_id, id, merchant, cat, date, total, pay, ret, war, has_photo, items,
     status, status_kind, status_at, reimbursable, client_updated_at, updated_at)
  select
    p_vault, (r->>'id')::bigint, coalesce(r->>'merchant',''), coalesce(r->>'cat','Other'),
    coalesce((r->>'date')::double precision,0), coalesce((r->>'total')::double precision,0),
    coalesce(r->>'pay',''), coalesce((r->>'ret')::int,0), coalesce((r->>'war')::int,0),
    coalesce((r->>'hasImage')::boolean,false), coalesce(r->'items','[]'::jsonb),
    coalesce(r->>'status','open'), nullif(r->>'statusKind',''), (r->>'statusAt')::bigint,
    coalesce((r->>'reimbursable')::boolean,false), coalesce((r->>'updatedAt')::bigint,0), now()
  from jsonb_array_elements(p_rows) as r
  on conflict (vault_id, id) do update set
    merchant=excluded.merchant, cat=excluded.cat, date=excluded.date, total=excluded.total,
    pay=excluded.pay, ret=excluded.ret, war=excluded.war, has_photo=excluded.has_photo,
    items=excluded.items, status=excluded.status, status_kind=excluded.status_kind,
    status_at=excluded.status_at, reimbursable=excluded.reimbursable,
    client_updated_at=excluded.client_updated_at, updated_at=now()
  where excluded.client_updated_at >= cr.client_updated_at and cr.deleted = false;
end;
$$;
```

---

## 3. Storage

Create a **private** bucket named `receipts` (Storage → New bucket → uncheck "Public"). The `sync` function issues signed upload/download URLs against it.

---

## 4. Edge functions

Redeploy all four to the new project (`supabase functions deploy <name> --project-ref <NEW_REF>`):

| Function | Notes |
|---|---|
| `extract-receipt` | photo → structured receipt (Claude) |
| `claim-helper` | drafts return/warranty emails |
| `sync` | push/pull/delete + signed photo URLs (service-role) |
| `inbound-email` | e-receipt webhook — **deploy with `--no-verify-jwt`** |

> If you don't have the function source locally, pull it from the current project first: `supabase functions download <name> --project-ref diifnystxiwurucolavk`.

---

## 5. Secrets (Edge Functions → Secrets on the new project)

- `ANTHROPIC_API_KEY` — real Claude extraction / claim drafting / email parsing
- `INBOUND_SECRET` — locks the email-import webhook (see `EMAIL_IMPORT.md`)

(The service-role key is injected automatically.)

---

## 6. Auth

Authentication → Sign In / Providers → **Email**:
- Keep **Email** provider enabled.
- **Confirm email**: on for production (needs SMTP), or off for a frictionless start.
- **Prevent use of leaked passwords**: on (Pro plan) + minimum length ≥ 8.
- URL Configuration → set the Site URL / redirect URLs if you later use email links.

---

## 7. Point the app at the new project

In `lib/config.ts` swap the two values (both are safe to ship):

```ts
export const SUPABASE_URL = 'https://<NEW_REF>.supabase.co';
export const SUPABASE_ANON_KEY = '<new anon key>';
```

Also update `INBOUND_DOMAIN` if you wire a mail provider (see `EMAIL_IMPORT.md`).

---

## 8. Verify

- [ ] Capture a receipt with AI extraction → returns structured data
- [ ] Cloud backup → **Sync now** → row appears in `cloud_receipts`; photo lands in the `receipts` bucket
- [ ] Restore with the same sync code on a second device → receipts pull in
- [ ] Create an account → `rv_user_vaults` gets one row; sign in on another device → same vault
- [ ] `get_advisors` (security) shows only the intentional `cloud_receipts` RLS-no-policy INFO
