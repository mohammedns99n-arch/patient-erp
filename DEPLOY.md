# Deploying to Vercel

The app is a standard Next.js 16 app that talks to Supabase. Deploying is:
push to GitHub → import into Vercel → set two environment variables → deploy.

## 0. One-time: make sure the database is ready
In your Supabase project's **SQL Editor**, confirm you have run:
- `schema.sql` (tables, triggers, RLS)
- everything in `migrations/` (Baghdad `first_visit_date`, `phone_number`)

## 1. Push to GitHub
The repo is already initialized and committed locally. Create an **empty** GitHub
repo (no README/gitignore), then from the project folder:

```bash
cd ~/Desktop/patient-erp
git remote add origin https://github.com/<your-username>/patient-erp.git
git push -u origin main
```

> `.env.local` is git-ignored, so your Supabase keys are NOT pushed — you set them
> in Vercel instead (next step).

## 2. Import into Vercel
1. Go to https://vercel.com → **Add New… → Project** → import the GitHub repo.
2. Framework preset: **Next.js** (auto-detected). Leave build/output settings default.
3. Before clicking Deploy, open **Environment Variables** and add both:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://mpmbbcqtqakkxvhfzqfz.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_…` (your publishable key) |

   (These are the same values as in your local `.env.local`. They are safe to expose
   to the browser — they're the *publishable* key, not the secret one.)
4. Click **Deploy**. First build takes a couple of minutes.

## 3. Point Supabase at the deployed URL
In Supabase → **Authentication → URL Configuration**, set **Site URL** to your Vercel
URL (e.g. `https://patient-erp.vercel.app`) and add it under **Redirect URLs**. This
keeps auth/email links pointing at production.

## 4. Verify
Open the Vercel URL, sign in with an existing account, and click through Dashboard /
Patients. Auto-deploy is now on: every `git push` to `main` redeploys.

## Notes
- **Node version**: Vercel uses its own Node; the local `~/.local/node` install is
  only for your machine.
- **New users** are still created in the Supabase dashboard (Authentication → Users);
  promote the first admin via SQL (see `README`/schema notes).
- To change env vars later: Vercel → Project → **Settings → Environment Variables**,
  then redeploy.
