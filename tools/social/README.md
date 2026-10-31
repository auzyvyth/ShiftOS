# SOCIAL-1: Threads, Facebook, Instagram (draft, owner approves, auto-post)

One Meta app covers all three. Built so far: **Threads** (`threads.mjs`).
Facebook and Instagram are planned (see `TODO.md` SOCIAL-1); their limits:
- **Facebook posts only to a PAGE**, never a personal profile (Meta removed that in 2018).
  Permission `pages_manage_posts`, a Page access token.
- **Instagram needs a Business or Creator account, and every post needs an image or
  video** (no text-only posts). The image must be at a public URL. Reuse the images the
  app already makes (loan poster, Studio); do not build a second image maker.
- **One idea, written per platform.** Same text pasted to all three does badly on all three.

Claude drafts posts in the owner's voice. The owner approves them. Approved posts
go out on schedule through Meta's **official Threads API**, and their numbers come
back so the next batch improves.

**Never post through a logged-in browser (Hermes/Chromium style).** Meta's terms
ban automated access like that, and the account can be flagged or banned.

## Weekly loop
1. **Draft** (Claude, once a week): 5-7 posts added to `queue.json` as `status: "draft"`,
   each with a `pillar` (topic) and a suggested `post_at` (ISO time, UTC).
2. **Approve** (owner, ~5 min): edit the text, then set `status: "approved"`.
   Only `approved` ever posts. A draft is never published by any command.
3. **Publish** (scheduled task): `node tools/social/threads.mjs publish --live`
   posts what is due and marks it `posted` with its `threads_id`.
4. **Learn**: `node tools/social/threads.mjs insights` saves views / likes /
   replies / reposts / quotes / shares per post; next week's drafts use them.

Every command without `--live` is a dry run. `npm run test:social` checks the rules.

## Rules the script enforces
- Max 500 characters (Threads' limit).
- Never "XDrive" in a post: the brand is Drevo (CLAUDE.md, BRAND-1).
- Saves after each post, so a crash mid-run never posts the same thing twice.

## Rules for the drafts (not checkable by code)
- Never invent a price, discount, instalment, loan rate or approval.
- No buyer names, phone numbers or screenshots of chats (PDPA).
- No domain typed in a post: link via `SITE_URL` (`src/config/site.js`) when drafting.

## One-time setup (owner only)
1. developers.facebook.com -> Create app -> use case **"Access the Threads API"**.
2. App roles -> add your Threads account as a **Threads Tester**; accept the invite in
   the Threads app (Settings -> Account -> Website permissions -> Invites).
3. Permissions: `threads_basic`, `threads_content_publish`, `threads_manage_insights`.
4. Generate a **long-lived token** (60 days) in the use case's settings.
5. Cloud environment settings -> Network access: allow `graph.threads.net`
   (later `graph.facebook.com` + `graph.instagram.com`). The default policy blocks it
   (checked 2026-10-31: CONNECT 403).
6. Save it as environment secrets, never in the repo:
   `THREADS_ACCESS_TOKEN`, and `THREADS_USER_ID` (from `threads.mjs whoami`).
7. The token runs out after 60 days: `threads.mjs refresh` renews it (needs to be at
   least a day old); save the printed token over the old secret.

## Safety
- Keep the Meta app in **Development mode**. It can then only post to accounts added as
  testers (yours). No App Review, no business verification needed. Never switch to Live.
- Leaked token: Threads app -> Settings -> Account -> Website permissions -> Active ->
  remove the app. That kills the token at once; generate a new one.
- Never give a third-party "auto-poster" your password. The official flow never asks for
  it outside Meta's own pages.

## Gotcha
This repo is PUBLIC (CLAUDE.md, Vercel Hobby), so drafts in `queue.json` are visible
before they post. Fine for ordinary posts; if that matters, move the queue to a
private repo or a Supabase table.
