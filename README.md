# Zembro landing

React/TypeScript + Vite, Motion, Express and SQLite. This is a standalone project; the CanvasHabitats repository and Zembro source artwork are unchanged.

## Local development

Requires patched Node 22.23.4+ in the 22.x release line and npm. On Windows, Node 22 is the verified runtime.

1. `npm ci`
2. Copy `.env.example` to `.env`; set a unique `EDITOR_PASSWORD` of at least 12 characters.
3. `npm run dev`
4. Open http://localhost:5173 and http://localhost:5173/admin.

The public page works without an editor password. CMS login is disabled until one is set. No default credentials are shipped. The API listens on 127.0.0.1:8788. Use localhost (not 127.0.0.1) for the browser so the configured write origin matches.

`npm run assets` rebuilds optimized artwork from `\\TOWER\Work\Zembro`; set `ARTWORK_DIR` to override the source directory. The ready-to-use web copies in `public/assets` are included. `sources.json` records their provenance. Original files are never modified. `npm run db:seed` initializes only a fresh database. Repeating it preserves edited content and translations.

## News and stories

`/news` lists published articles; `/news/:slug` displays an article and its image gallery or MP4 video. The homepage shows the three latest stories. Navigation, dates, controls and seeded articles support Dutch, English, French and German. Missing translations inherit Dutch; explicitly empty fields remain empty.

Sign in at `/admin`, then choose **News** in the toolbar. Create an article or select an existing one, edit the URL slug/date, switch translation tabs, select/upload media and save. The first image becomes the cover. **Published** controls public visibility; uncheck it and save to return an article to draft. Saves are atomic, errors retain input, and closing with unsaved changes prompts before discarding. Referenced article media cannot be deleted from the library. Article body accepts plain paragraphs and `##` headings; raw HTML is displayed as text.

Five initial articles are editorial adaptations of Zembro-owned LinkedIn posts, imported on 12 October 2026, including original images and the SafeTrx Active announcement video. `public/assets/news/sources.json` records original text, canonical post links and dates derived from the LinkedIn activity timestamps. These are a one-time import, not an automatic LinkedIn sync. The idempotent `seed-v17-news` migration stores articles and media in SQLite and never overwrites subsequent edits. Future stories are managed in the CMS. Other authors' reposts were excluded.

## Audience pages

`/for-loved-ones` explains checking in on a parent, emergency contacts and everyday follow-up. `/for-care-providers` explains client/device/location management, immediate alert response and proactive review of activity reports. Both are informational pages, use the shared navigation, flowing section edges, light/dark tokens and Motion reveals, and preserve language/query parameters. The header and footer include both audience links; smaller laptops use the existing menu interaction to accommodate longer translations.

All copy and hero imagery are editable under the `lovedOnes` and `careProviders` CMS groups in NL/EN/FR/DE. `seed-v11-audiences` adds these groups and the Loved Ones menu fields without changing existing page edits; only the original sales menu URL migrates to the local provider page. Custom menu destinations and intentionally empty translations remain intact. Audience sections are fixed and do not join the homepage reorder list.

Copy was checked on 12 October 2026 against Zembro's [EverCare](https://zembro.com/nl/pages/subscription-evercare), [Mini Pro](https://zembro.com/products/essentials-mini-pro), [Silver Shield](https://zembro.com/en-nl/pages/silver-shield), [care platform](https://zembro.com/) and [healthcare organisations](https://zembro.com/en-nl/pages/healthcare-organizations) material. Available functions are described as dependent on the chosen devices, sensors and configuration. Proactive review means using reports to inform human follow-up; no predictive diagnosis or guaranteed response time is promised. The supplied phone illustration is identified as product artwork with example values.

## Product catalogue

`/products` presents Silver Shield first in a white section, followed by Mini, Oktave, Comfort and Wander Alert in full-width sections. Silver Shield's overview and detail page share the homepage's CMS-managed light/dark corner renders; edit those images in the Ambient group. Each product has a local detail route beneath `/products/`; wearable purchase links lead to the existing Zembro Shopify product pages, while Silver Shield leads to its demo/enquiry page. Pricing, subscription selection, stock and checkout remain in Shopify. No cart or payment data is stored here.

The `catalog` and `product*` CMS groups contain all four translations, product imagery and shop destinations. Existing installations receive additive content migrations on startup; edited landing content and custom links are preserved. Untouched landing product links now lead to local details. The header Products link opens the overview; Technology and About return to the corresponding landing sections. Internal navigation retains language and other query parameters. Product sections follow the catalogue order; the CMS layout tool still only reorders the landing sections.

The products overview uses a Cycles-rendered product family on a white linen table in sunlight, with a separately lit dark teal studio for dark mode. Edit `catalog.heroImage`, `heroImageAlt`, `heroImageDark` and `heroImageDarkAlt` through the CMS. The additive hero migrations preserve existing catalogue edits; `seed-v13-mini-dark` upgrades only original/v2 image selections to the Mini model rebuilt from supplied front/side/back/dock renders and adds the dark fields. Editable Blender source and build notes are in `artwork/products/`; the illustrative device models are approximate exterior geometry, not manufacturer CAD. The complete row is retained at mobile widths. Theme changes crossfade between the two renders, respecting reduced motion.

Supplied Mini, Oktave and Silver Shield imagery is reused. Comfort and Wander Alert images are optimized copies from the official Shopify store, recorded in `public/assets/product-sources.json`. Run `npm run assets:products` to regenerate those copies. Product descriptions were checked against the official `/products/zembro-mini`, `/products/oktave`, `/products/comfort`, `/products/wander-alert` and `/pages/silver-shield` pages on 12 October 2026.

## CMS

Privacy and terms live at `/privacy` and `/terms`, using the same navigation, theme and language preferences. Published NL, EN and FR policy text was copied from the Zembro Shopify policy URLs on 12 October 2026; the source snapshot and checksums are in `artwork/legal/source-policies.json`. The DE policy URLs returned 404, so German visitors see a clear notice and the Dutch original marked with `lang="nl"`. No legal translation or change in meaning was generated. The policies describe the existing Zembro service and shop, including their published references to cookies and third parties.

Edit `legalPrivacy` and `legalTerms` through the CMS. Text is split into numbered `body` blocks to keep the existing 10,000-character field limit; headings (`##`), bold (`**`), links, lists and tables render safely without raw HTML. `seed-v9-legal` adds missing content and upgrades only the original default footer URLs, preserving edits and custom links. To re-import source text for review, run `py -3 scripts/import-legal.py` on Windows (Python 3 plus the project's Node runtime); re-importing does not overwrite existing CMS values.

Sign in at `/admin`, select **Edit page**, then click text/imagery or choose any field in the sidebar. Edit NL, EN, FR and DE individually; **Save changes** persists changed translations and refreshes the public page. Changing a field or closing an editor with unsaved content asks before discarding it. Saves publish immediately; no draft/publish workflow is implied. If a multi-language save partially succeeds, successful language tabs are marked saved while unsaved translations remain editable for retry.

Layout moves save immediately. Header, hero and footer are fixed. Media uploads support PNG/JPEG/WebP/MP4, up to 60 MB. Referenced files cannot be deleted. Text, link destinations, alternative descriptions, metadata, logo and film are editable. Choose an image's `imageAlt` field (or the corresponding background alternative) to edit its accessible description.

`?lang=nl|en|fr|de` overrides the saved language; Dutch is the first-visit default. Successful language loads persist selection. Missing translations fall back to Dutch; explicit empty strings do not. Dark mode follows the OS until toggled, and the saved override is applied before paint.

## API

All routes live beneath `${BASE_PATH}/api`. Public: `GET /health`, `/sites/zembro/content?lang=…`, `/sites/zembro/sections`, `/media/:id`. Auth: `GET /auth/session`, `POST /auth/login` (`{password}`), `POST /auth/logout`. Editor-only: `GET /sites/zembro/editor`, `/sites/zembro/sections/:section/fields/:path/values`, `PUT /sites/zembro/sections/:section/fields/:path` (`{lang,value}`), `PUT /sites/zembro/sections/reorder` (`{order}`), `GET/POST /media`, `DELETE /media/:id`. Upload uses multipart `file`; media field values contain media ID strings. Browser writes require the exact configured Origin and an authenticated cookie except for login/logout.

Sessions expire after eight hours and are kept in memory, so restarting the server signs editors out. Content and uploaded media persist in SQLite. Invalid input returns 400, unauthorized access 401, foreign-origin writes 403, referenced media deletion 409, and throttled login 429. The public page shows errors without substituting fabricated content. Source types are in `shared/types.ts`.

## Checks

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

## Content sources

Copy is adapted from the supplied Zembro artwork and these checked pages (12 October 2026):

- https://zembro.com/nl
- https://zembro.com/nl/pages/silver-shield — AI/mmWave, fall/activity monitoring, no cameras or microphones
- https://zembro.com/nl/collections/zembro-solutions/products/zembro-mini — wearable SOS and communication
- https://zembro.com/nl/pages/contact-us
- https://zembro.com/nl/pages/sales
- https://zembro.com/nl/policies/privacy-policy

No prices, invented testimonials, or numeric effectiveness claims are included. The supplied app imagery is presented as product imagery, not a live status display. Translations are initial editorial translations and can be refined through the CMS.

### LinkedIn news archive

The CMS includes twelve editorial articles adapted from original Zembro LinkedIn posts, with locally stored images and video. The older batch covers 16 October–11 December 2025. Dates are derived from the publication timestamp encoded in each LinkedIn activity identifier. Original text and source links are retained in `public/assets/news/sources.json` and `older-sources.json`; research captures are in `artwork/news`.

`seed-v17-news` and `seed-v18-news-archive` import each batch once. Existing slugs and CMS edits are preserved. These are curated imports, not an automatic LinkedIn synchronisation. Edit articles, translations and media through `/admin` → News.

See `deploy/README.md` for DigitalOcean instructions. The site is deployed at https://zembro.planetarypixel.be.
