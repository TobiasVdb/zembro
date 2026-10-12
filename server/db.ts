import Database from 'better-sqlite3'
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { seedContent, initialAmbientBodies } from './content.js'
import { audienceContent, audienceHeader } from './audiences.js'
import { LANGUAGES, SECTION_KEYS } from '../shared/types.js'
export function openDatabase(dataDir: string) {
  mkdirSync(dataDir, { recursive: true })
  const db = new Database(path.join(dataDir, 'app.db'))
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(`
 CREATE TABLE IF NOT EXISTS sections (key TEXT PRIMARY KEY, position INTEGER NOT NULL, reorderable INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS fields (id INTEGER PRIMARY KEY, section TEXT NOT NULL REFERENCES sections(key), path TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('text','link','image','video')), UNIQUE(section,path));
 CREATE TABLE IF NOT EXISTS field_values (field_id INTEGER NOT NULL REFERENCES fields(id), lang TEXT NOT NULL CHECK(lang IN ('nl','en','fr','de')), value TEXT NOT NULL, PRIMARY KEY(field_id,lang));
 CREATE TABLE IF NOT EXISTS media (id INTEGER PRIMARY KEY, filename TEXT NOT NULL, mime_type TEXT NOT NULL, hash TEXT UNIQUE NOT NULL, data BLOB NOT NULL);
 CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
 `)
  return db
}
export function addMedia(
  db: Database.Database,
  data: Buffer,
  filename: string,
  mime: string,
): number {
  const hash = createHash('sha256').update(data).digest('hex')
  db.prepare('INSERT OR IGNORE INTO media(filename,mime_type,hash,data) VALUES (?,?,?,?)').run(
    filename,
    mime,
    hash,
    data,
  )
  const row = db.prepare('SELECT id FROM media WHERE hash=?').get(hash) as { id: number }
  return row.id
}
export function seedDatabase(db: Database.Database, assetDir: string) {
  const seeded = db.prepare("SELECT value FROM settings WHERE key='seed-v1'").get()
  const productsSeeded = db.prepare("SELECT value FROM settings WHERE key='seed-v2-products'").get()
  if (
    seeded &&
    productsSeeded &&
    db.prepare("SELECT value FROM settings WHERE key='seed-v3-product-links'").get() &&
    db.prepare("SELECT value FROM settings WHERE key='seed-v4-ambient'").get() &&
    db.prepare("SELECT value FROM settings WHERE key='seed-v5-corner-render'").get() &&
    db.prepare("SELECT value FROM settings WHERE key='seed-v6-dark-corner'").get() &&
    db.prepare("SELECT id FROM fields WHERE section='ambient' AND path='imageDarkAlt'").get() &&
    db.prepare("SELECT value FROM settings WHERE key='seed-v7-sensor-geometry'").get() &&
    db.prepare("SELECT value FROM settings WHERE key='seed-v8-reverse-view'").get() &&
    db.prepare("SELECT value FROM settings WHERE key='seed-v9-legal'").get() &&
    db.prepare("SELECT value FROM settings WHERE key='seed-v10-products-hero'").get() &&
    db.prepare("SELECT value FROM settings WHERE key='seed-v11-audiences'").get() &&
    db.prepare("SELECT value FROM settings WHERE key='seed-v12-products-geometry'").get() &&
    db.prepare("SELECT value FROM settings WHERE key='seed-v13-mini-dark'").get()
  )
    return
  db.transaction(() => {
    for (const [position, key] of SECTION_KEYS.entries()) {
      if (seeded && productsSeeded) continue
      // Add the catalogue to existing installations without touching their edited landing fields.
      if (seeded && key !== 'catalog' && !key.startsWith('product')) continue
      db.prepare('INSERT OR IGNORE INTO sections VALUES (?,?,?)').run(
        key,
        position,
        ['wearable', 'ambient', 'platform', 'impact'].includes(key) ? 1 : 0,
      )
      for (const field of seedContent[key]) {
        db.prepare('INSERT OR IGNORE INTO fields(section,path,type) VALUES (?,?,?)').run(
          key,
          field.path,
          field.type,
        )
        const row = db
          .prepare('SELECT id FROM fields WHERE section=? AND path=?')
          .get(key, field.path) as { id: number }
        let mediaId: number | undefined
        if (field.type === 'image' || field.type === 'video') {
          const file = field.values.nl
          mediaId = addMedia(
            db,
            readFileSync(path.join(assetDir, file)),
            file,
            file.endsWith('.mp4')
              ? 'video/mp4'
              : file.endsWith('.png')
                ? 'image/png'
                : 'image/webp',
          )
        }
        for (const lang of LANGUAGES)
          db.prepare('INSERT OR IGNORE INTO field_values VALUES (?,?,?)').run(
            row.id,
            lang,
            mediaId === undefined ? field.values[lang] : String(mediaId),
          )
      }
    }
    // Only migrate untouched default destinations; custom editor links remain intact.
    for (const [section, fieldPath, destination] of [
      ['wearable', 'link', '/products/mini'],
      ['wearable', 'watchLink', '/products/oktave'],
      ['ambient', 'link', '/products/silver-shield'],
    ] as const) {
      const original = seedContent[section].find((field) => field.path === fieldPath)?.values.nl
      db.prepare(
        `UPDATE field_values SET value=? WHERE value=? AND field_id=(
        SELECT id FROM fields WHERE section=? AND path=?)`,
      ).run(destination, original, section, fieldPath)
    }
    db.prepare("INSERT OR IGNORE INTO settings VALUES ('seed-v1','done')").run()
    db.prepare("INSERT OR IGNORE INTO settings VALUES ('seed-v2-products','done')").run()
    db.prepare("INSERT OR IGNORE INTO settings VALUES ('seed-v3-product-links','done')").run()
    if (!db.prepare("SELECT value FROM settings WHERE key='seed-v4-ambient'").get()) {
      const body = seedContent.ambient.find((field) => field.path === 'body')
      for (const lang of LANGUAGES) {
        db.prepare(
          `UPDATE field_values SET value=? WHERE lang=? AND value=? AND field_id=(
          SELECT id FROM fields WHERE section='ambient' AND path='body')`,
        ).run(body?.values[lang], lang, initialAmbientBodies[lang])
      }
      const originalHash = createHash('sha256')
        .update(readFileSync(path.join(assetDir, 'sensor.webp')))
        .digest('hex')
      const oldMedia = db.prepare('SELECT id FROM media WHERE hash=?').get(originalHash) as
        { id: number } | undefined
      if (oldMedia) {
        const repaired = addMedia(
          db,
          readFileSync(path.join(assetDir, 'sensor-clean.webp')),
          'sensor-clean.webp',
          'image/webp',
        )
        db.prepare(
          `UPDATE field_values SET value=? WHERE value=? AND field_id=(
          SELECT id FROM fields WHERE section='ambient' AND path='image')`,
        ).run(String(repaired), String(oldMedia.id))
      }
      db.prepare("INSERT INTO settings VALUES ('seed-v4-ambient','done')").run()
    }
    if (!db.prepare("SELECT value FROM settings WHERE key='seed-v5-corner-render'").get()) {
      const render = addMedia(
        db,
        readFileSync(path.join(assetDir, 'silver-shield-corner.webp')),
        'silver-shield-corner.webp',
        'image/webp',
      )
      // Upgrade only the original/repaired default illustration, not an uploaded replacement.
      for (const filename of ['sensor.webp', 'sensor-clean.webp']) {
        const hash = createHash('sha256')
          .update(readFileSync(path.join(assetDir, filename)))
          .digest('hex')
        const old = db.prepare('SELECT id FROM media WHERE hash=?').get(hash) as
          { id: number } | undefined
        if (old)
          db.prepare(
            `UPDATE field_values SET value=? WHERE value=? AND field_id=(
          SELECT id FROM fields WHERE section='ambient' AND path='image')`,
          ).run(String(render), String(old.id))
      }
      const alt = seedContent.ambient.find((field) => field.path === 'imageAlt')
      const oldAlts = {
        nl: 'Silver Shield-sensor voor discrete omgevingsmonitoring',
        en: 'Silver Shield sensor for discreet ambient monitoring',
        fr: 'Capteur Silver Shield pour un suivi ambiant discret',
        de: 'Silver Shield-Sensor für diskrete Umgebungsüberwachung',
      }
      for (const lang of LANGUAGES)
        db.prepare(
          `UPDATE field_values SET value=? WHERE lang=? AND value=? AND field_id=(
        SELECT id FROM fields WHERE section='ambient' AND path='imageAlt')`,
        ).run(alt?.values[lang], lang, oldAlts[lang])
      db.prepare("INSERT INTO settings VALUES ('seed-v5-corner-render','done')").run()
    }
    if (
      !db.prepare("SELECT value FROM settings WHERE key='seed-v6-dark-corner'").get() ||
      !db.prepare("SELECT id FROM fields WHERE section='ambient' AND path='imageDarkAlt'").get()
    ) {
      const filename = 'silver-shield-corner-dark.webp'
      const media = addMedia(
        db,
        readFileSync(path.join(assetDir, filename)),
        filename,
        'image/webp',
      )
      db.prepare(
        "INSERT OR IGNORE INTO fields(section,path,type) VALUES ('ambient','imageDark','image')",
      ).run()
      const field = db
        .prepare("SELECT id FROM fields WHERE section='ambient' AND path='imageDark'")
        .get() as { id: number }
      for (const lang of LANGUAGES) {
        db.prepare('INSERT OR IGNORE INTO field_values VALUES (?,?,?)').run(
          field.id,
          lang,
          String(media),
        )
      }
      db.prepare(
        "INSERT OR IGNORE INTO fields(section,path,type) VALUES ('ambient','imageDarkAlt','text')",
      ).run()
      const altField = db
        .prepare("SELECT id FROM fields WHERE section='ambient' AND path='imageDarkAlt'")
        .get() as { id: number }
      const alt = seedContent.ambient.find((field) => field.path === 'imageDarkAlt')
      for (const lang of LANGUAGES) {
        db.prepare('INSERT OR IGNORE INTO field_values VALUES (?,?,?)').run(
          altField.id,
          lang,
          alt?.values[lang],
        )
      }
      db.prepare("INSERT OR IGNORE INTO settings VALUES ('seed-v6-dark-corner','done')").run()
    }
    if (!db.prepare("SELECT value FROM settings WHERE key='seed-v7-sensor-geometry'").get()) {
      for (const [field, oldFile, newFile] of [
        ['image', 'silver-shield-corner.webp', 'silver-shield-corner-v2.webp'],
        ['imageDark', 'silver-shield-corner-dark.webp', 'silver-shield-corner-dark-v2.webp'],
      ]) {
        const media = addMedia(
          db,
          readFileSync(path.join(assetDir, newFile)),
          newFile,
          'image/webp',
        )
        const oldHash = createHash('sha256')
          .update(readFileSync(path.join(assetDir, oldFile)))
          .digest('hex')
        const old = db.prepare('SELECT id FROM media WHERE hash=?').get(oldHash) as
          { id: number } | undefined
        if (old)
          db.prepare(
            `UPDATE field_values SET value=? WHERE value=? AND field_id=(
          SELECT id FROM fields WHERE section='ambient' AND path=?)`,
          ).run(String(media), String(old.id), field)
      }
      db.prepare("INSERT INTO settings VALUES ('seed-v7-sensor-geometry','done')").run()
    }
    if (!db.prepare("SELECT value FROM settings WHERE key='seed-v8-reverse-view'").get()) {
      for (const [field, oldFile, newFile] of [
        ['image', 'silver-shield-corner-v2.webp', 'silver-shield-reverse.webp'],
        ['imageDark', 'silver-shield-corner-dark-v2.webp', 'silver-shield-reverse-dark.webp'],
      ]) {
        const media = addMedia(
          db,
          readFileSync(path.join(assetDir, newFile)),
          newFile,
          'image/webp',
        )
        const oldHash = createHash('sha256')
          .update(readFileSync(path.join(assetDir, oldFile)))
          .digest('hex')
        const old = db.prepare('SELECT id FROM media WHERE hash=?').get(oldHash) as
          { id: number } | undefined
        if (old)
          db.prepare(
            `UPDATE field_values SET value=? WHERE value=? AND field_id=(
          SELECT id FROM fields WHERE section='ambient' AND path=?)`,
          ).run(String(media), String(old.id), field)
      }
      db.prepare("INSERT INTO settings VALUES ('seed-v8-reverse-view','done')").run()
    }
    if (!db.prepare("SELECT value FROM settings WHERE key='seed-v9-legal'").get()) {
      for (const section of ['legalPrivacy', 'legalTerms'] as const) {
        db.prepare('INSERT OR IGNORE INTO sections VALUES (?,?,0)').run(
          section,
          SECTION_KEYS.indexOf(section),
        )
        for (const field of seedContent[section]) {
          db.prepare('INSERT OR IGNORE INTO fields(section,path,type) VALUES (?,?,?)').run(
            section,
            field.path,
            field.type,
          )
          const row = db
            .prepare('SELECT id FROM fields WHERE section=? AND path=?')
            .get(section, field.path) as { id: number }
          for (const lang of LANGUAGES)
            db.prepare('INSERT OR IGNORE INTO field_values VALUES (?,?,?)').run(
              row.id,
              lang,
              field.values[lang],
            )
        }
      }
      for (const [field, oldUrl, destination] of [
        ['privacyLink', 'https://zembro.com/nl/policies/privacy-policy', '/privacy'],
        ['termsLink', 'https://zembro.com/nl/policies/terms-of-service', '/terms'],
      ])
        db.prepare(
          `UPDATE field_values SET value=? WHERE value=? AND field_id=(
          SELECT id FROM fields WHERE section='footer' AND path=?)`,
        ).run(destination, oldUrl, field)
      db.prepare("INSERT INTO settings VALUES ('seed-v9-legal','done')").run()
    }
    if (!db.prepare("SELECT value FROM settings WHERE key='seed-v10-products-hero'").get()) {
      for (const field of seedContent.catalog.filter((field) =>
        ['heroImage', 'heroImageAlt'].includes(field.path),
      )) {
        db.prepare('INSERT OR IGNORE INTO fields(section,path,type) VALUES (?,?,?)').run(
          'catalog',
          field.path,
          field.type,
        )
        const row = db
          .prepare('SELECT id FROM fields WHERE section=? AND path=?')
          .get('catalog', field.path) as { id: number }
        const value =
          field.type === 'image'
            ? String(
                addMedia(
                  db,
                  readFileSync(path.join(assetDir, field.values.nl)),
                  field.values.nl,
                  'image/webp',
                ),
              )
            : undefined
        for (const lang of LANGUAGES)
          db.prepare('INSERT OR IGNORE INTO field_values VALUES (?,?,?)').run(
            row.id,
            lang,
            value ?? field.values[lang],
          )
      }
      db.prepare("INSERT INTO settings VALUES ('seed-v10-products-hero','done')").run()
    }
    if (!db.prepare("SELECT value FROM settings WHERE key='seed-v11-audiences'").get()) {
      for (const section of ['header', 'lovedOnes', 'careProviders'] as const) {
        const fields = section === 'header' ? audienceHeader : audienceContent[section]
        db.prepare('INSERT OR IGNORE INTO sections VALUES (?,?,0)').run(
          section,
          SECTION_KEYS.indexOf(section),
        )
        for (const field of fields) {
          db.prepare('INSERT OR IGNORE INTO fields(section,path,type) VALUES (?,?,?)').run(
            section,
            field.path,
            field.type,
          )
          const row = db
            .prepare('SELECT id FROM fields WHERE section=? AND path=?')
            .get(section, field.path) as { id: number }
          const media =
            field.type === 'image'
              ? String(
                  addMedia(
                    db,
                    readFileSync(path.join(assetDir, field.values.nl)),
                    field.values.nl,
                    'image/webp',
                  ),
                )
              : undefined
          for (const lang of LANGUAGES)
            db.prepare('INSERT OR IGNORE INTO field_values VALUES (?,?,?)').run(
              row.id,
              lang,
              media ?? field.values[lang],
            )
        }
      }
      // Move only the original menu destination; preserve custom editor links.
      db.prepare(
        `UPDATE field_values SET value='/for-care-providers' WHERE value='https://zembro.com/nl/pages/sales'
        AND field_id=(SELECT id FROM fields WHERE section='header' AND path='professionalLink')`,
      ).run()
      db.prepare("INSERT INTO settings VALUES ('seed-v11-audiences','done')").run()
    }
    if (!db.prepare("SELECT value FROM settings WHERE key='seed-v12-products-geometry'").get()) {
      const filename = 'products-sunny-table-v2.webp'
      const revised = addMedia(
        db,
        readFileSync(path.join(assetDir, filename)),
        filename,
        'image/webp',
      )
      const originalHash = createHash('sha256')
        .update(readFileSync(path.join(assetDir, 'products-sunny-table.webp')))
        .digest('hex')
      // Replace only the original supplied hero; preserve custom CMS selections and empty fields.
      db.prepare(
        `UPDATE field_values SET value=?
        WHERE field_id=(SELECT id FROM fields WHERE section='catalog' AND path='heroImage')
        AND value IN (SELECT CAST(id AS TEXT) FROM media WHERE hash=?)`,
      ).run(String(revised), originalHash)
      db.prepare("INSERT INTO settings VALUES ('seed-v12-products-geometry','done')").run()
    }
    if (!db.prepare("SELECT value FROM settings WHERE key='seed-v13-mini-dark'").get()) {
      const filename = 'products-sunny-table-v3.webp'
      const revised = addMedia(
        db,
        readFileSync(path.join(assetDir, filename)),
        filename,
        'image/webp',
      )
      for (const old of ['products-sunny-table.webp', 'products-sunny-table-v2.webp']) {
        const hash = createHash('sha256')
          .update(readFileSync(path.join(assetDir, old)))
          .digest('hex')
        db.prepare(
          `UPDATE field_values SET value=?
          WHERE field_id=(SELECT id FROM fields WHERE section='catalog' AND path='heroImage')
          AND value IN (SELECT CAST(id AS TEXT) FROM media WHERE hash=?)`,
        ).run(String(revised), hash)
      }
      for (const field of seedContent.catalog.filter((field) =>
        ['heroImageDark', 'heroImageDarkAlt'].includes(field.path),
      )) {
        db.prepare('INSERT OR IGNORE INTO fields(section,path,type) VALUES (?,?,?)').run(
          'catalog',
          field.path,
          field.type,
        )
        const row = db
          .prepare("SELECT id FROM fields WHERE section='catalog' AND path=?")
          .get(field.path) as { id: number }
        const value =
          field.type === 'image'
            ? String(
                addMedia(
                  db,
                  readFileSync(path.join(assetDir, field.values.nl)),
                  field.values.nl,
                  'image/webp',
                ),
              )
            : undefined
        for (const lang of LANGUAGES)
          db.prepare('INSERT OR IGNORE INTO field_values VALUES (?,?,?)').run(
            row.id,
            lang,
            value ?? field.values[lang],
          )
      }
      db.prepare("INSERT INTO settings VALUES ('seed-v13-mini-dark','done')").run()
    }
  })()
}
