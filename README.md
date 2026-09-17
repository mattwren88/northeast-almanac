# The Northeast Almanac

A two-week calendar of things to do across Northeast Pennsylvania — markets, gallery
openings, hikes, dive bars, opera-house touring acts — laid out like a weekend
newspaper. Free, no ads, no tracking, no account.

**Live:** <https://mattwren88.github.io/northeast-almanac/>

Listings come from public calendars run by the venues and publishers themselves, and
every entry links back to its source. A GitHub Action re-scrapes them each morning.

## How it works

No backend and no database — a static site plus a JSON file that a scheduled job
rewrites:

```
scripts/build-events.mjs   fetches ~14 days of events + weather  ─┐
                                                                  ├→ public/events.json
.github/workflows/scrape.yml   runs it daily at 06:00 ET         ─┘
                                                                          ↓
src/  React app, built by Vite  ───────────────────────────────→  GitHub Pages
```

The app fetches `events.json` at runtime with `cache: 'no-store'`, so a fresh scrape
shows up on the next page load without rebuilding the bundle. If that file is missing
or unreachable, it falls back to `public/mock-events.json` and flags the data as mock
in the masthead.

### Layout

| Path                       | What's in it                                                          |
| -------------------------- | --------------------------------------------------------------------- |
| `src/app.jsx`              | Masthead, toolbar, filters, colophon, About modal, plan/toasts        |
| `src/calendar.jsx`         | Week grid, plus the time-formatting and `.ics`/calendar-link helpers  |
| `src/views.jsx`            | Map (Leaflet), Weekend, Index (Fuse search), event drawer, saved plan |
| `src/lib/data.js`          | Event loading, the day↔date anchor math, categories, weather          |
| `src/lib/constants.js`     | `BBOX` and `HORIZON_DAYS`, shared with the scraper                    |
| `src/data/sources.js`      | The one source registry — UI attribution _and_ scraper endpoints      |
| `src/theme.js`             | Light/dark theme state                                                |
| `scripts/build-events.mjs` | The scraper                                                           |
| `curated.json`             | Manual `featured` / `hidden` overrides, applied at scrape time        |

Adding or changing a source means editing `src/data/sources.js` only — the footer,
the About modal, the drawer's "Listing via" credit, and the scraper all read from it.

## Development

Requires Node 18+.

```bash
npm install
npm run dev       # Vite dev server
npm run build     # production build → dist/
npm run preview   # serve the built site at the real /northeast-almanac/ base path
npm run scrape    # re-run the scraper → public/events.json
```

The dev server serves `public/events.json` as-is, so you'll see whatever the last
scrape committed until you run `npm run scrape` yourself.

### Scraper safety rails

`build-events.mjs` refuses to overwrite `events.json` when a run looks wrong, so a
source going down or changing its API can't silently blank the site:

- every event is schema-validated; the run fails if >20% get dropped
- a hard floor of 10 valid events
- a sharp-drop guard if the count falls by more than half from the previous run

It also sends `If-Modified-Since` and reuses cached events on a `304`, and identifies
itself with a contactable User-Agent. Each source's `robots.txt` was reviewed before
being added — see the notes in `src/data/sources.js`, and re-check them if you fork
this and point a new User-Agent at those hosts.

## Deployment

Pushes to `main` build and deploy to GitHub Pages via `.github/workflows/deploy.yml`.
The daily scrape chains the same workflow after committing new data (a push made with
`GITHUB_TOKEN` doesn't trigger `push`-event workflows on its own).

Repo setting required: **Settings → Pages → Source = GitHub Actions**.

## Corrections & removals

If you run a venue or source listed here and want a listing pulled, the cadence
changed, or your name spelled right — [open an issue](https://github.com/mattwren88/northeast-almanac/issues).
Usually fixed within a day.

## License

Code is [MIT](LICENSE). Event data belongs to the venues that publish it; this site
only points at it.
