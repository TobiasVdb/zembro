# Verification — 12 October 2026

## Automated checks

- Production build (`npm run build`): passed, including TypeScript checks and compiled Express server. Production main JavaScript bundle: approximately 393 kB / 124 kB gzip. Local configuration leaves NODE_ENV unset so Vite selects its production build mode.
- Lint (`npm run lint`): passed without warnings.
- API tests (`npm test`): 13 passed, zero failed. Covers public language content, unauthorized access, login/cookies/same-origin restrictions, translation fallback versus intentional empty values, invalid fields/links/media, complete transactional reordering, protected media references, byte ranges, upload signature validation, seed idempotency, database reopening, logout, throttling, expiring sessions and subpath media URLs.
- Linux deployment templates: checked for UTF-8 without BOM and LF line endings.

## Browser and runtime checks

Chrome was used with desktop and emulated mobile viewports. All four languages in both light and dark themes were checked for horizontal overflow. The 320px German headline was corrected after visual inspection. No clipped headings or horizontal overflow remained in the eight narrow-mobile combinations.

Confirmed story-film playback with browser readyState 4 and advancing playback time; Escape closed the dialog and restored focus to its trigger. Mobile menu opening and Escape dismissal worked. Section navigation and once-per-visit reveal animations were inspected. All page images loaded successfully after scrolling.

Confirmed language switching, rapid language changes, preservation of other query parameters, reload persistence, and theme persistence. The public page recovered through its retry control after a development API restart.

In an isolated disposable database, confirmed CMS login, click-to-edit, a saved English headline appearing in the public page, reload persistence, retained draft content after a rejected unsafe-link save, recovery of the invalid draft, and section reordering/restoration. Restarted the compiled production server and confirmed the saved test headline remained in SQLite. The delivered database contains the original seeded content, not these test edits.

Screenshots and desktop combination results are under the ignored `verification/` directory.

## Remaining manual checks

- Browser file upload was blocked by the Chrome extension's local-file access restriction. Multipart uploads and media validation passed API tests; the browser picker workflow remains unverified.
- Reduced-motion support is implemented in Motion and CSS. The available browser control does not expose reduced-motion emulation, so a live OS/browser preference check remains manual.
- Mobile checks used viewport emulation, not a physical device.
- DigitalOcean provisioning, Linux service startup, Nginx/HTTPS, backup scheduling and restore have not been exercised on a droplet. Templates and instructions are prepared; nothing is deployed.
- Initial editorial translations should receive the normal brand/language review before publication.

## Products extension — 12 October 2026

- Added a section-based catalogue and five local product detail routes, sharing landing typography, waves, reveal animations, themes and four-language CMS fields.
- `npm test`: 16 passed, zero failed. Added catalogue translations/routes, authenticated product edits, local-link validation and additive migration preservation checks.
- `npm run lint` and `npm run build`: passed, including client/server TypeScript checks. Main JavaScript bundle is approximately 410 kB / 128 kB gzip.
- Compiled production server smoke check: health, catalogue, all five product detail URLs and both new optimized product images returned HTTP 200.
- Chrome: visually inspected English light and German dark catalogue sections and Comfort detail; confirmed the Comfort purchase link opens its existing Shopify product page. No purchase was made.
- At 390px, German catalogue and Comfort detail had no horizontal overflow. The browser screenshot viewport override produced incorrectly scaled captures, so a reliable visual mobile recheck remains manual for these new pages.
- New product fields reuse the existing CMS editor; persistence and validation passed API tests. A separate browser editing session for these fields was not repeated.
- Screenshot: `verification/products-desktop.png`. No deployment performed.

## Language menu refinement — 12 October 2026

- Replaced the native header select with a themed animated menu, full language names and a selected-language checkmark. Uses existing Motion and Phosphor dependencies.
- Chrome confirmed arrow-key focus movement, Enter language selection, Escape dismissal with focus restoration, and outside-click dismissal. Visually inspected light and dark menus.
- Lint passed; all 16 existing API tests passed. Screenshot: `verification/language-dropdown.png`.

## Public text readability — 12 October 2026

- Mini and Oktave actions now share the same 16px teal text-link styling, arrow size and hover behavior. Watch thumbnail increased; narrow-phone wearable content stacks rather than shrinking the link and feature text.
- Increased similarly small public labels, navigation, footer/legal links, privacy copy and purchase notes. CMS controls unchanged.
- Chrome visually checked desktop and 390px phone wearable layouts; both actions computed at 16px, phone features at 14px, with no horizontal overflow. Lint passed.
- Screenshots: `verification/wearable-mobile.png` and `verification/wearable-actions.png`.

## Silver Shield section cleanup — 12 October 2026

- Repaired the supplied cropped sensor with the built-in image editing tool, saved source `public/assets/sensor-repaired.png` and optimized `sensor-clean.webp`; original sensor/artwork retained. Prompt and provenance in `sensor-clean-source.json`. Repaired casing edges are reconstructed from the supplied reference, rather than a new manufacturer render.
- Removed signal-ring decoration, raised/reoriented the sensor toward the upper room boundary, and removed repeated privacy wording from the paragraph in all four languages.
- Added an idempotent default-only migration for ambient text/media. Custom CMS copy and selected imagery remain unchanged. Regression test covers preservation and repeat seeding.
- Lint and all 17 tests passed. Desktop and 390px phone composition visually inspected; no horizontal overflow. Screenshot: `verification/ambient-mobile.png`.

## Favicon — 12 October 2026

- Added ICO and 32px PNG favicons plus a 180px Apple touch icon, extracted from the supplied Zembro logo mark without redrawing it.
- Metadata uses Vite BASE_URL; artwork preparation regenerates the icons. All three local URLs returned HTTP 200 with appropriate MIME types; Chrome confirmed icon metadata. Lint passed.
