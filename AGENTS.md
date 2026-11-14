# Voyce for Paws app

How this project is built and shipped:

- **Code:** GitHub, `main` branch. Changes go in through pull requests.
- **Hosting:** Cloudflare Pages. Project `voyceforpaws-d30c2cfd` deploys the app
  (app.voyceforpaws.org) automatically from `main`.
- **Data:** Supabase project `voyce-prod`.
- **Shelter data:** the GitHub Actions workflow `acs-refresh.yml` runs
  `acs-pull/pull_acs.py` every 15 minutes.

The project is **not** built or edited through Lovable any more. Some build
tooling still carries Lovable's name (the `@lovable.dev/vite-tanstack-config`
package in `vite.config.ts`). It is an ordinary npm package and works without a
Lovable account.

Keep `main` deployable: every merge to it goes live on Cloudflare.
