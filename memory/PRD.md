# Avero — Product Requirements Document

## Original Problem Statement
Build a production-ready SaaS hospitality management platform ("Avero") for Cafes and Restaurants. Cafe and Restaurant must be two genuinely different workspaces sharing one platform, auth and database. Full merchant onboarding (referral → business type → free subscription → business info → GST/FSSAI compliance → summary → dashboard tour). Launch offer: all features free (₹0) until 2027-01-15 23:59:59 IST, then automatic switch to paid pricing (₹49/149/249/449). Server-side pricing security. Admin panel. Strict business data isolation.

## Architecture
- **Backend**: FastAPI + MongoDB (motor). Single `server.py`. JWT email/password auth (httpOnly cookies + Bearer). All routes under `/api`.
- **Frontend**: React (CRA/craco, JSX) + Tailwind + shadcn/ui + recharts + framer-motion. Fonts: Plus Jakarta Sans / JetBrains Mono. Brand: lime #B8FF00 / ink #08090C.
- **Data isolation**: every business collection scoped by `business_id` via `require_business` dependency. Cross-business access returns 404. Verified across 8+ resource types.
- **Pricing**: server computes `launch_active` from `pricing_config.launchOfferEnd` (not browser clock).

## User Personas
- **Cafe owner/manager** — fast service, quick billing, tables, menu.
- **Restaurant owner/manager** — KOT/kitchen workflow, dine-in/takeaway/delivery, table occupancy.
- **Staff** — Manager/Cashier/Waiter/Kitchen Staff roles.
- **Avero admin** — configures launch offer, announcement and pricing.

## Core Requirements (static)
Auth, onboarding, dual workspaces (cafe/restaurant), Orders, Tables, Menu, Billing, KOT (restaurant), Inventory, Customers, Staff, Expenses, Reports, Analytics, Settings, Admin, launch countdown + auto pricing switch, mobile responsive.

## Implemented (2026-06 / v1) — ✅ tested 100% backend, key frontend flows
- JWT auth: register/login/logout/me/refresh/forgot-password/reset-password + admin seeding + brute-force lockout.
- 7-step onboarding wizard with resume + editable summary; referral analytics; GST format validation; optional FSSAI.
- Cafe & Restaurant dashboards (distinct metrics, sidebar, mobile bottom nav; KOT only for restaurant).
- Orders POS (menu picker, table/customer, discount/tax computed server-side), status flow, billing → payment + receipt, customer stat updates, table state transitions.
- Restaurant KOT board (auto-created from orders, kanban columns, status sync).
- CRUD: menu (categories/items/availability), tables (floor grid), inventory (+ stock adjust & transactions), customers, staff, expenses.
- Reports (today/yesterday/week/month/all) + Analytics (charts).
- Landing page (announcement countdown IST, hero + product preview, business types, features, how-it-works, pricing launch/regular, FAQ, footer).
- Admin panel: platform stats, referral breakdown, editable pricing/announcement/launch date.
- Server-side launch offer + automatic pricing switch.

## Added (v1.1 / v1.2)
- **QR ordering + UPI**: per-table secure QR (revocable), separate customer accounts, server-side amount recompute (anti-manipulation), idempotent payment confirm, KOT-after-payment, merchant QR Orders page. Razorpay per-merchant keys in Settings (TEST mode until keys added). 29/29 backend tests pass.
- **Admin branding**: admin uploads a logo → replaces logos site-wide + favicon (GET /api/branding, /api/branding/logo; POST/DELETE /api/admin/branding/logo, base64 singleton).
- **Launch readiness**: CORS reads CORS_ORIGINS (credentials-safe); reports use indexed Mongo date filters; no deployment blockers.

## Backlog / Remaining
- **P1**: Google sign-in (user will provide OAuth keys); real Razorpay live verification once a merchant adds keys.
- **P2**: menu add-ons/variants; split-bill; QR order sound/browser notifications; CSV export; pagination on large lists.
- **P2**: Split `server.py` into routers if it grows.

## Test Credentials
Admin: peanplays.2006@gmail.com / Avero@2026 (→ /admin). Merchants: register fresh via /signup.
