# Security notes

## Implemented in this code
- Passwords and sessions handled by Supabase Auth; cookies managed by `@supabase/ssr`; tokens validated with `auth.getUser()` in middleware and server code.
- Roles stored only in `public.profiles`. Every admin action re-checks the role in the database (`requireAdmin`). Row Level Security on all four tables; regular users have read-only access. A trigger blocks role/status changes by non-admins and by admins on themselves. New sign-ups are always `user`.
- Audit log written by database triggers; no client can insert, update or delete log rows; admin read-only.
- All queries go through the Supabase client (parameterised). Search input is length-limited and stripped of wildcard characters. IDs are validated as UUIDs.
- Uploads: admin only (app and storage policy), 2 MB limit, JPEG/PNG/WebP decided by file signature, random server-generated filenames, SVG refused, bucket restricted by MIME type.
- Headers: CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy. Server Actions apply Next.js's built-in Origin check (CSRF). No service-role key in the code. Errors shown to users are fixed messages.

## Not implemented / known limitations
- No automated tests, dependency audit, static analysis or penetration test have been run. Run `npm audit` and your own review before production.
- MFA is available in Supabase but is not enforced in the app for administrators.
- Login rate limiting relies on Supabase Auth's built-in limits; there is no app-level limiter on admin actions.
- CSP allows `'unsafe-inline'` scripts (needed by Next.js without nonces).
- Image bucket is public-read (unguessable filenames); orphaned images are not deleted when records are removed.
- Not built yet: user management page, activity log page, edit-item and edit-category forms, password reset page, deactivation UI (deactivate by setting `active = false` in SQL).
