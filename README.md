# Stockroom

Inventory management web app: Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase (Postgres, Auth, Storage).

**Status: first build, not yet installed, built or tested.** See SECURITY.md for what is and is not implemented.

## Setup
1. `npm install`
2. Create a project at supabase.com. In **SQL Editor**, paste and run `supabase/schema.sql`. It creates the tables, constraints, RLS policies, audit triggers and the `inventory-images` storage bucket with admin-only write policies.
3. `cp .env.example .env.local` and fill in the project URL and **anon** key (Project Settings > API). Never use the service-role key here.
4. In Supabase > Authentication: set Site URL to your domain, enable email confirmation, set minimum password length to 12, and enable MFA (TOTP). Review the rate limits under Authentication > Rate Limits.
5. Run `npm run dev` and open http://localhost:3000.

## First administrator
Register normally at `/register`, confirm your email, then run this once in the SQL Editor (the editor is not subject to the profile guard, so this is the only way to create an admin):

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```
Sign out and in again. A "Manage inventory" link appears. Later admins are promoted the same way.

## Build and deploy
`npm run build && npm start`, or deploy to Vercel: import the repo and set the two environment variables. Serve only over HTTPS.

## Backups and recovery
- Enable daily backups (Supabase Pro) and Point-in-Time Recovery if you need minute-level recovery. Keep at least 14 daily backups.
- Weekly logical dump kept for 90 days: `pg_dump "$DATABASE_URL" -Fc -f stockroom-$(date +%F).dump`. Store it outside Supabase.
- Restore into a fresh project: run `pg_restore --no-owner -d "$NEW_DATABASE_URL" file.dump`. Storage images are not in the dump; export the `inventory-images` bucket separately.
- Categories cannot be deleted while they contain items (`ON DELETE RESTRICT`); the app only ever deletes one record per action.


## Cart and order approval feature

For an existing Supabase setup, open **Supabase → SQL Editor** and run `supabase/order-system-migration.sql` once. This creates the order tables and secure RPCs required by the cart. If setting up a fresh project, `supabase/schema.sql` now includes these objects.

Users can add in-stock items to the persistent browser cart, submit an order request, and view its status under **My orders**. Requests remain pending until an administrator approves or rejects them in **Manage inventory → Order requests**. Stock is reduced only when approval succeeds; approval locks and validates the requested stock rows so the operation is atomic. The floating cart button intentionally shows no item-count badge.
