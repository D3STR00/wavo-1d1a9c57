
# Wavo — MVP Rebuild Plan

Following your own doctrine: **freeze complexity, ship the core loop first**. We build only what proves `Intent → Wave → Match → Chat`. Everything else (geofencing, verification, expiry timers, feedback loops, reliability score) is documented but **not built in v1**.

## Scope of v1

**In:**
- Auth (phone OTP via Supabase)
- Set intent (Coffee / Walk / Talk / Gym)
- Nearby screen — the product's home
- Wave action → Wavo alert → mutual match
- Contextual chat (unlocked only on match)
- Minimal identity reveal card (post-match)
- Locked visual system (dark `#0C0C14`, purple→teal banner, Syne + DM Sans, per-intent color worlds)

**Out (deferred, tracked in-doc):**
- Map view, geofencing, "not in your area", waitlist
- Selfie/ID verification, reliability score, live location share, safety screen
- Intent expiry timers, "still down?" ping, post-meet feedback
- Deep profile editing (profile stays as "minimum truth container")
- Fake-density fallback, session anchoring nudges

## Screens (v1)

1. **Auth** — phone + OTP, minimal
2. **Onboarding** — first name + avatar initials + pick default intent (single step, <30s)
3. **Home = Nearby** — the app. Banner (logo, live count, bell) + intent pills + presence row + card list
4. **Chat** — only accessible via a match; header shows the shared intent
5. **Profile micro-sheet** — opens as a bottom sheet from a matched card, not a page: name, avatar, current intent, one line. Two actions: Chat / Dismiss

Bottom nav: **Nearby · Chat · Profile** (3 tabs, not 4 — Feed is Nearby)

## The Wave→Wavo mechanic (core loop)

1. Tap 👋 on a card → sender marked `live + interested`, receiver gets a **Wavo alert** (in-app toast, not a notification permission ask in v1)
2. Alert shows for ~20s with **Wave back / Pass**
3. Both waved → `matches` row created → both cards flip to **Matched** state (green gradient, ✓) → chat unlocked
4. Cooldown per (sender, receiver) pair to prevent spam
5. Wave visibility decays after a few minutes (backend TTL, no visible countdown)

## Data model (Supabase, connected project)

I'll inspect your existing schema first. If tables are missing, I'll generate a migration script for you to run in the Supabase SQL editor (I can't run migrations against your external project from here).

Target tables:

- `profiles` — id (auth uid), first_name, avatar_seed, created_at
- `intents` — id, user_id, kind (`coffee|walk|talk|gym`), status (`live|idle|matched`), created_at, expires_at
- `user_presence` — user_id (PK), last_seen_at, is_online
- `waves` — id, from_user, to_user, intent_id, status (`sent|returned|passed|expired`), created_at
- `matches` — id, user_a, user_b, intent_kind, created_at
- `chat_messages` — id, match_id, user_id, body, created_at

RLS on every table. Realtime enabled on `waves`, `matches`, `chat_messages`, `user_presence`. Simple `status = live|idle|matched` derived view per your "one state per screen" rule.

## Visual system (locked from your doc)

- Background `#0C0C14`, banner gradient (deep purple → teal), two blurred glow circles (top-right purple, bottom-left teal)
- Fonts: Syne (display), DM Sans (body) via `@fontsource`
- Logo gradient: `#A78BFA` → `#34D399`
- Per-intent color tokens (Coffee amber, Walk green, Talk purple, Gym orange-red) as CSS variables in `src/styles.css`
- All colors semantic tokens — never hardcoded in components
- Card = its intent's color world (bg + glow + button gradient + faint emoji watermark)
- States per card: **Available** (subtle glow + live dot), **Normal** (muted), **Matched** (solid highlight + ✓)

## Technical stack

- TanStack Start (existing template) + React 19 + Tailwind v4
- Browser Supabase client for the current session (`localStorage`)
- Realtime subscriptions wired in `__root.tsx` + per-screen hooks
- Auth-gated routes under `src/routes/_authenticated/` (Nearby, Chat, Profile); `/auth` public
- No edge functions in v1 — all reads/writes go through Supabase client with RLS

## Build order

1. Design tokens + fonts + banner shell (visible immediately)
2. Auth (phone OTP) + onboarding
3. Nearby screen with mocked data, so the UI stabilizes before realtime
4. Schema audit → migration script (I hand you SQL if anything is missing)
5. Wire Nearby to real `intents` + `user_presence`
6. Wave → Wavo alert → match flow with realtime
7. Chat (contextual, tied to `match_id`)
8. Profile micro-sheet

## What I need from you before build starts

1. **Supabase URL + publishable/anon key** — the browser client needs these. Paste them or add via secrets.
2. **Confirm phone OTP** as the auth method (vs. email as a temporary stand-in while you set up an SMS provider like Twilio in Supabase — SMS costs money and requires config on your Supabase project I can't do from here).
3. **Confirm scope** — I'll defer everything under "Security & Safety Layer", geofencing, verification, and timers. OK to build the loop first and layer those on later?

Once you answer those, I'll switch to build mode and start with the visual shell.
