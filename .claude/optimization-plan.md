# Northeast Almanac — production-readiness & optimization plan

Audit performed 2026-07-26 against commit `96b0258`. Everything below was verified by
running the build, splitting the bundle, and probing the live site — not estimated.
Nothing has been implemented yet. **Work has not started.**

## How to resume

Read this file, then start at Tier 1. Items are ordered easiest → hardest.
`permissions.defaultMode` is already set to `bypassPermissions` in
`.claude/settings.local.json`, so no prompts should appear.

Two items (14, 15) are blocked on user decisions — see "Blocked on Matt" below.
Everything else can proceed unattended.

## Verified baseline (re-measure after changes to confirm improvement)

Bundle, from `npm run build`:

```
dist/assets/index-*.js    459.21 kB │ gzip: 137.73 kB   ← single chunk, no splitting
dist/assets/index-*.css    66.41 kB │ gzip:  15.89 kB
```

Split by dependency (measured with a temporary `manualChunks` probe config):

| Chunk | Raw | Gzip | Needed on first paint? |
| --- | --- | --- | --- |
| react + react-dom | 186 KB | 58 KB | yes |
| leaflet | 149 KB | 43 KB | **no** — Map view only |
| leaflet.markercluster | 34 KB | 8.9 KB | **no** |
| fuse.js | 26 KB | 9.4 KB | **no** — Index view only |
| app code | 60 KB | 17 KB | yes |
| leaflet CSS | 15 KB | 6.4 KB | **no** |

Default view is `calendar` (Week), so ~209 KB raw / 62 KB gzip of JS plus 17 KB of
Leaflet CSS is downloaded and parsed for views most readers never open.

Data file: `public/events.json` is 388,397 bytes raw, 400 events, 14 weather days.

Live site headers (verified against https://mattwren88.github.io/northeast-almanac/):
GitHub Pages **does** gzip (58,817 bytes over the wire) and **does** honor
`If-None-Match` (returns `304`). This is what makes item 1 work.

Current checks all pass: `npx eslint .` → 0 errors / 3 warnings,
`npx prettier --check .` → clean, `npm run build` → succeeds.

## Blocked on Matt

- **Item 14** — is `map-view.png` (326 KB, repo root, currently unreferenced and not
  in `public/` so not deployed) meant to become the `og:image` social preview, or
  should it be deleted? If it becomes the preview it needs resizing first.
- **Item 18** — `HORIZON_DAYS` cleanup: cosmetic swap, or properly generalize the
  week-pagination math? See the trap noted in the item.

Ask about these when you reach them; do not guess. Everything else is unblocked.

---

# Tier 1 — one-liners, no judgment calls (~15 min, one diff)

Independent of each other. Safe to do as a single commit.

### 1. Switch `no-store` → `no-cache`
`src/lib/data.js:110`. Change `cache: 'no-store'` to `cache: 'no-cache'`.
Identical freshness (still revalidates every load, as the README promises), but most
loads become a bodyless 304 instead of a 58 KB transfer. Best effort-to-impact ratio
on the list. Do not touch the `force-cache` on `mock-events.json` at line 12.

### 2. Add fetch timeouts to the scraper
`scripts/build-events.mjs` — 7 `fetch` call sites (weather, Tribe pages, UofS JSON,
RSS). Add `signal: AbortSignal.timeout(15000)` to each. Currently a source that
accepts the connection then stalls hangs the whole daily job.

### 3. Add `timeout-minutes: 10` to workflow jobs
`.github/workflows/scrape.yml`, `.github/workflows/ci.yml`,
`.github/workflows/deploy.yml`. None currently set it, so all inherit GitHub's
6-hour default. Belt to item 2's braces.

### 4. Guard the localStorage write
`src/app.jsx:319`. Wrap in try/catch, copying the pattern already at
`src/theme.js:35`. Safari private mode throws here, and a throw inside a `useEffect`
unmounts the tree.

### 5. Fix `dateForDay().iso`
`src/lib/data.js:74`. Replace `dt.toISOString().slice(0, 10)` with local Y-M-D
assembly (there's a `ymd()` helper in the scraper and `pad2` in `calendar.jsx` to
copy). Verified broken: for `TZ=Europe/Berlin`, `Asia/Tokyo`, `Australia/Sydney`,
`iso` comes back one day behind the `date`/`weekday` fields it sits next to.
`iso` feeds ICS `DTSTART`, the Google/Outlook calendar URLs, and the ListView From/To
range, so a European visitor exports events on the wrong day.

Verify with:
```bash
for tz in America/New_York UTC Europe/Berlin Asia/Tokyo; do TZ=$tz node -e "…"; done
```

### 6. `fromCharCode` → `fromCodePoint`
`scripts/build-events.mjs:113`. Currently mangles astral-plane characters (emoji in
scraped event titles).

### 7. Clear the two trivial eslint warnings
`src/views.jsx:389` (`dayInRange` missing dep) and `src/views.jsx:704` (move `lookup`
inside the `useMemo`). Noise reduction so the one real warning — item 12 — stops
hiding in the pile. **Leave `views.jsx:120` alone here**; it needs the care described
in item 12.

### 8. Add a sitemap.xml
New file in `public/`. Five lines, single URL. `public/robots.txt` is currently a bare
`Allow: /` with nothing aiding discovery.

**Verify Tier 1:** `npx eslint . && npx prettier --check . && npm run build`

---

# Tier 2 — small and contained (~45 min unblocked)

### 9. Centralize weather access
Add a `weatherFor(day)` accessor in `src/lib/data.js` that can never return
`undefined`, then replace every raw `WEATHER[d]` read:
`src/calendar.jsx:85`, `src/views.jsx:236`, `src/views.jsx:451`,
`src/views.jsx:553`, `src/app.jsx:663`.

Why it matters: each of those immediately dereferences `wx.icon` / `wx.cond` /
`wx.high`. `src/lib/data.js:116-117` replaces the WEATHER array **in place with
whatever length `j.weather` has**. If Open-Meteo ever returns fewer than 14 days,
every index past the end throws `TypeError` → blank page.

**Do this together with item 13** — same call sites, and splitting them means editing
each file twice.

### 10. Add an error boundary
New component, wrapped around `<App />` in `src/main.jsx`. Nothing in the codebase
currently implements `componentDidCatch` / `getDerivedStateFromError`, so any render
throw is a permanent white page. Reuse the existing `error-state` markup and CSS
already at `src/app.jsx:686-697` so the fallback looks intentional.

### 11. Harden the map tooltip escape
`src/views.jsx:110`. Currently escapes only `<` via `.replace(/</g, '&lt;')`.
That is adequate for HTML text content, so this is hardening rather than a live bug —
but it's the one raw-HTML path fed by third-party scraped data. Use a proper escape
helper covering `& < > " '`.

### 12. Fix the stale `onOpen` in the marker effect
`src/views.jsx:120`. The effect omits `onOpen` and `dayEvents` from its deps, so
marker click handlers close over a stale `onOpen`.

**Careful:** naively adding `onOpen` to the dep array rebuilds and re-clusters every
marker on each parent render. Either `useCallback` the handler in `app.jsx` (it's
`viewEvent`, defined at `src/app.jsx:265`) or hold it in a ref. Latent today because
the handler is behaviorally identical each render — fix it properly, don't paper over
it.

### 13. Fail visibly when weather is missing
The highest-integrity fix on the list. Currently: `scripts/build-events.mjs:651`
catches a weather-fetch failure and writes `weather: null`;
`src/lib/data.js:114` then leaves the **hardcoded April placeholder array**
(`src/lib/data.js:24-39` — `68°/49°`, `Sat`, etc.) in place. The masthead still reads
"live". The rain advisory banner and the "Outdoor · rain forecast" dimming then run on
placeholder temperatures with zero signal to the reader.

Design decision already made: **do not fail the scrape** (a weather outage must not
block event updates). Instead let `weather: null` propagate and have the UI render
weather as `—`, suppress the advisory banner (`src/app.jsx:655-681`), and skip the
outdoor-dimming (`src/calendar.jsx:120`). Delete or clearly quarantine the mock
WEATHER array so it can never masquerade as live data.

### 14. Add `og:image` — **BLOCKED, see above**
`index.html`. No `og:image` today and `twitter:card` is `summary`, so link previews are
bare text. Matters for a site distributed by word of mouth.

### 15. Decide what `VOL. III · NO. 17` means — **BLOCKED, see above**
`src/app.jsx:501`. Hardcoded and never changes. Five lines of code once the editorial
question is answered: derive from the anchor date, or drop it.

---

# Tier 3 — real work

### 16. Bootstrap tests + cover the pure functions (~1 hour for the first useful slice)
**Do this before item 17.** Add vitest, a `test` script to `package.json`, and a CI
step in `.github/workflows/ci.yml`. There are currently zero tests and no framework;
CI only runs eslint / prettier / build / `node --check`, which catches syntax errors,
not logic.

In ascending setup cost:
1. The three scraper guards — `guardSchema`, `guardHardFloor`, `guardSharpDrop` at
   `scripts/build-events.mjs:370-386`. Pure functions, zero fixtures, and they are the
   only thing standing between a bad scrape and a blanked site. Start here.
2. The ICS / gcal / Outlook builders in `src/calendar.jsx:205-327`. Pure.
3. The day-offset math in `src/lib/data.js` (needs `TZ` control — would have caught
   item 5).
4. `normalize` / `dedupe` in the scraper (needs captured API fixtures).

**If tests surface a bug in `normalize` or `dedupe`, stop and report it rather than
silently expanding scope.**

### 17. Lazy-load Leaflet, markercluster, and Fuse (~1 hour)
The 45% first-load cut: 137 KB → ~75 KB gzip.

The reason this isn't trivial: `src/views.jsx` (807 lines) exports `MapView`,
`WeekendView`, `ListView`, `EventDrawer`, and `WeekendPlan` from one file, so a
dynamic import of it pulls Leaflet in regardless. The actual task:

1. Split `views.jsx` along view boundaries (map / list / drawer / plan).
2. Move the three Leaflet CSS imports out of `src/main.jsx:1-3` into the map chunk.
3. `React.lazy` + `<Suspense>` around MapView and ListView in `src/app.jsx:716-735`.
4. Keep `WeekendView` eager — it's cheap and has no heavy deps.

Note `key={view}` at `src/app.jsx:699` remounts the whole view on switch, which for
Map means tearing down and rebuilding the Leaflet map every time. Intentional for the
fade transition; don't "fix" it as part of this, but be aware of it.

**Verify by actually clicking through all four views** — Playwright MCP is available.
Then re-run the build and confirm the chunk split.

### 18. Make `HORIZON_DAYS` authoritative — **BLOCKED, see above**
Five hardcoded `14`s: `src/calendar.jsx:33`, `src/calendar.jsx:37`,
`src/app.jsx:660`, `src/views.jsx:44`, `src/lib/data.js:96`.

**The trap:** swapping in the constant *looks* like it generalizes the code, but
`src/calendar.jsx` also assumes 7-day weeks with `weekOffset` constrained to 0..1
(`src/app.jsx:197`), which only holds because 14 = 2×7. A cosmetic swap leaves the
codebase worse than the honest hardcoding, because it advertises flexibility that
isn't there. Either do the week-pagination math properly or leave the literals and
add a comment explaining why.

### 19. Self-host the fonts (~45 min — weakest estimate on this list)
Three families (Newsreader, Instrument Serif, JetBrains Mono) currently loaded from
Google Fonts as a render-blocking third-party request — in `index.html:43-48` **and**
`public/404.html`. Download, subset, add `@font-face`, remove both `preconnect`s from
both files.

**Honest limitation:** "renders identically" can be screenshot-compared across both
themes with Playwright to catch gross regressions, but subtle metric shifts in a
design this typography-dependent are exactly what screenshots miss. Expect a round of
Matt's eyes on this one; don't claim it's verified beyond what was actually checked.

### 20. Component / integration tests (ongoing)
Needs jsdom + testing-library on top of item 16. Highest-value targets, in order:
hash round-tripping (`src/app.jsx:188-227`), the focus capture/restore contract
(`src/app.jsx:58-71`), and the saved-plan merge from a `?share=` link
(`src/app.jsx:231-245`).

---

## What's already solid — don't "improve" these

Flagged so they don't get refactored by mistake:

- The three-guard scraper safety rail (`scripts/build-events.mjs:370-386`) is real
  engineering. Extend it, don't loosen it.
- The single source registry in `src/data/sources.js` correctly drives both UI
  attribution and scraper endpoints. Keep it as the one place a source is defined.
- The documented robots.txt review in `src/data/sources.js:11-19` is more diligence
  than most commercial scrapers manage. If a source is added, re-verify and document.
- `deploy.yml`'s `workflow_call` handling of the `GITHUB_TOKEN` push limitation is
  correct and well-commented.
- Accessibility was not an afterthought — `aria-pressed` / `aria-modal` coverage and
  the focus management are in good shape. Preserve them through any refactor.

## Deliberate trade-offs — leave alone unless asked

- `events.json` is pretty-printed (`JSON.stringify(out, null, 2)`,
  `scripts/build-events.mjs:702`). 388 KB raw vs ~250 minified, but it buys readable
  git diffs on a file committed daily. Correct call as-is.
- The Fuse index rebuilds on every filter change because `ListView` receives already
  filtered events. At 400 events that's single-digit milliseconds. Not worth
  complicating.
