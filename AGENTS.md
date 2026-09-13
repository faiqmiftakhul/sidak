# SIDAK — Agent Notes

Sistem Indikasi Audit Klaim (BPJS Kesehatan, demo Kota Semarang).
- Backend: `api/main.py` (FastAPI) + `functions/` (Cloudflare Pages Functions, port 1:1)
- Frontend: `web/` (React + Vite); data statis di `web/public/data/`
- Deploy: `npx wrangler pages deploy web/dist --project-name sidak --branch v17-semantic-colors --commit-dirty=true`

## Anti-slop

<!-- ANTISLOP:BEGIN -->
When working in this repository — building or editing UI, copy, comments, or
layout — apply the skills in `.agents/skills/`:

- `antislop` (core filter) — load always
- `antislop-ui` — visual work (color, layout, components, motion)
- `antislop-copywriting` — copy & text (headlines, CTAs, product prose)
- `antislop-human` — accessibility & people
- `antislop-layoutmobile` — responsive/mobile layout
- `antislop-code` — code comments

The design reference for this project lives in `DESIGN.md` (create it if the
user gives creative direction). End UI work with the antislop Delivery Gate
(PASS/FAIL report) before shipping.
<!-- ANTISLOP:END -->
