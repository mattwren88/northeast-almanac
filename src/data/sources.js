// Single registry of every listing source. Consumed by:
//   · the footer colophon and About modal (name + home)
//   · the event drawer's "Listing via" attribution (SOURCES_BY_ID)
//   · scripts/build-events.mjs (api/type/town/coords — keep plain JS, no imports)
//
// `id` becomes the event-id prefix (kept short and stable so curated.json keys
// keep matching). Order matters: earlier sources win on dedupe collisions.
//
// robots.txt review (verified 2026-05-09):
//   discovernepa.com         — User-agent: * allows /wp-json/. AI-training crawlers
//                              are blocked; we are not one. ✓
//   happeningsmagazinepa.com — Disallows specific /calendar/action~* views; the
//                              /wp-json/tribe/events/v1/events REST endpoint is
//                              not blocked. ✓
//   lclshome.org             — Only /wp-admin/ blocked. ✓
//   scrantonpa.gov           — Only /wp-admin/ blocked. ✓
//   events.scranton.edu      — no robots.txt at host root; standard public events feed. ✓
//   25livepub.collegenet.com — User-agent: * Disallow: (empty) → fully allowed. ✓
//   www.keystone.edu         — User-agent: * Disallow: (empty), Crawl-delay: 10 — we
//                              hit it once per daily run, well under that. ✓
// Re-verify if you fork this and aim a new UA at any of them.

export const SOURCES = [
  {
    id: 'dn', name: 'DiscoverNEPA', audience: 'community', type: 'tribe',
    home: 'https://discovernepa.com/events/',
    api: 'https://discovernepa.com/wp-json/tribe/events/v1/events',
  },
  {
    id: 'hm', name: 'Happenings Magazine', audience: 'community', type: 'tribe',
    home: 'https://www.happeningsmagazinepa.com/events/',
    api: 'https://www.happeningsmagazinepa.com/wp-json/tribe/events/v1/events',
  },
  {
    id: 'lcl', name: 'Lackawanna County Library System', audience: 'community', type: 'tribe',
    home: 'https://lclshome.org/events/',
    api: 'https://lclshome.org/wp-json/tribe/events/v1/events',
  },
  {
    id: 'scr', name: 'City of Scranton', audience: 'community', type: 'tribe',
    home: 'https://scrantonpa.gov/events/',
    api: 'https://scrantonpa.gov/wp-json/tribe/events/v1/events',
  },
  {
    id: 'uosc', name: 'University of Scranton', audience: 'college', type: 'uos-json',
    home: 'https://events.scranton.edu/',
    api: 'https://events.scranton.edu/_data/current-live.json',
    town: 'Scranton', coords: [41.4044, -75.6601],
  },
  {
    id: 'mary', name: 'Marywood University', audience: 'college', type: 'rss-trumba',
    home: 'https://www.marywood.edu/community/news-events',
    api: 'https://25livepub.collegenet.com/calendars/marywood-calendar-month.rss?filterview=All+Events&filter2=_*Academic+Affairs_*Academics_*Alumni+Events_*Art+Dept.._*Art+Exhibits_*Athletic+Games_*Athletics_*Camps_*Campus+Ministry_*Career+Services_*Clinics_*Community+Event_*Conferences+and+Events_*CSD+Dept.._*Development_*Housing+and+Residence+Life_*Kresge+Gallery_*Mahady+Gallery_*Maslow+Gallery_*Military+and+Veteran+Services_*Music_*Nursing_*Physician+Assistant+Program_*Psychology+and+Counseling+Dept.._*Registrar_*School+of+Business+Dept.._*School+of+Humanities_*School+of+Visual+%26+Performing+Arts_*Social+Sciences+Dept.._*Social+Work+Dept.._*Student+Accounts_*Student+Engagement_*Student+Exhibition_*Student+Health+Services_*Suraci+Gallery_&filterfield2=25983',
    town: 'Scranton', coords: [41.4218, -75.6519],
  },
  {
    id: 'key', name: 'Keystone College', audience: 'college', type: 'rss-wp',
    home: 'https://www.keystone.edu/keystone-events/',
    api: 'https://www.keystone.edu/events/feed/',
    town: 'La Plume', coords: [41.5868, -75.7825],
  },
];

export const COMMUNITY_SOURCES = SOURCES.filter(s => s.audience === 'community');
export const COLLEGE_SOURCES = SOURCES.filter(s => s.audience === 'college');
export const SOURCES_BY_ID = Object.fromEntries(SOURCES.map(s => [s.id, s]));

export const WEATHER_SOURCE = { name: 'Open-Meteo', home: 'https://open-meteo.com' };
