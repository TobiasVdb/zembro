import express, { type Request, type Response, type NextFunction } from 'express'
import cookieParser from 'cookie-parser'
import multer from 'multer'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type Database from 'better-sqlite3'
import path from 'node:path'
import {
  isLang,
  isSectionKey,
  SECTION_KEYS,
  PRODUCTS,
  type Content,
  type FieldType,
  type Section,
  type Lang,
} from '../shared/types.js'
import { addMedia } from './db.js'
import { AUDIENCE_PATHS, LEGAL_PATHS, PUBLIC_PATHS } from '../shared/routes.js'
interface Options {
  db: Database.Database
  password: string
  origin?: string
  basePath?: string
  production?: boolean
  distDir?: string
  sessionMs?: number
}
interface FieldRow {
  id: number
  section: string
  path: string
  type: FieldType
}
interface ValueRow {
  lang: Lang
  value: string
}
interface MediaRow {
  id: number
  filename: string
  mime_type: string
  data: Buffer
}
const wrap =
  (fn: (req: Request, res: Response) => void) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      fn(req, res)
    } catch (error) {
      next(error)
    }
  }
const safeLink = (value: string) => {
  if (!value) return true
  if (PUBLIC_PATHS.includes(value)) return true
  try {
    const url = new URL(value)
    return ['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol)
  } catch {
    return /^#[a-z][\w-]*$/i.test(value)
  }
}
export function createApp({
  db,
  password,
  origin,
  basePath = '/',
  production = false,
  distDir = path.resolve('dist'),
  sessionMs = 8 * 60 * 60 * 1000,
}: Options) {
  const app = express()
  app.disable('x-powered-by')
  if (production) app.set('trust proxy', 1)
  const base = '/' + basePath.split('/').filter(Boolean).join('/')
  const prefix = base === '/' ? '' : base
  const api = express.Router()
  const cookieName = 'zembro_session'
  const sessions = new Map<string, number>()
  const attempts = new Map<string, { count: number; until: number }>()
  const hash = (text: string) => createHash('sha256').update(text).digest()
  const authenticated = (req: Request) => {
    const token: unknown = req.cookies?.[cookieName]
    if (typeof token !== 'string') return false
    const expiry = sessions.get(token)
    if (!expiry || expiry <= Date.now()) {
      sessions.delete(token)
      return false
    }
    return true
  }
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!authenticated(req)) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }
    next()
  }
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: production,
    path: prefix || '/',
    maxAge: sessionMs,
  }
  app.use(cookieParser())
  app.use(express.json({ limit: '128kb' }))
  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff')
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.set('X-Frame-Options', 'DENY')
    next()
  })
  api.use((req, res, next) => {
    res.set('Cache-Control', 'no-store')
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const expected = origin || `${req.protocol}://${req.get('host')}`
      if (req.get('origin') !== expected || req.get('sec-fetch-site') === 'cross-site') {
        res.status(403).json({ error: 'Same-origin request required' })
        return
      }
    }
    next()
  })
  api.get(
    '/health',
    wrap((_req, res) => {
      db.prepare('SELECT 1').get()
      res.json({ ok: true })
    }),
  )
  api.get('/auth/session', (req, res) =>
    res.json({ authenticated: authenticated(req), configured: password.length >= 12 }),
  )
  api.post('/auth/login', (req, res) => {
    if (password.length < 12) {
      res.status(503).json({
        error: 'Set EDITOR_PASSWORD (at least 12 characters) on the server before signing in.',
      })
      return
    }
    const ip = req.ip || 'unknown'
    const now = Date.now()
    for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key)
    const attempt = attempts.get(ip)
    if (attempt && attempt.count >= 8) {
      res.set('Retry-After', String(Math.ceil((attempt.until - now) / 1000)))
      res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' })
      return
    }
    const submitted: unknown = req.body?.password
    if (typeof submitted !== 'string' || !timingSafeEqual(hash(submitted), hash(password))) {
      attempts.set(ip, {
        count: (attempt?.count || 0) + 1,
        until: attempt?.until || now + 15 * 60 * 1000,
      })
      res.status(401).json({ error: 'Incorrect password' })
      return
    }
    attempts.delete(ip)
    for (const [token, expiry] of sessions) if (expiry <= now) sessions.delete(token)
    const token = randomBytes(32).toString('hex')
    sessions.set(token, now + sessionMs)
    res.cookie(cookieName, token, cookieOptions).json({ authenticated: true })
  })
  api.post('/auth/logout', (req, res) => {
    const token: unknown = req.cookies?.[cookieName]
    if (typeof token === 'string') sessions.delete(token)
    res.clearCookie(cookieName, cookieOptions).json({ authenticated: false })
  })
  api.use('/sites/:site', (req, res, next) => {
    if (req.params.site !== 'zembro') {
      res.status(404).json({ error: 'Unknown site' })
      return
    }
    next()
  })
  const fields = () => db.prepare('SELECT * FROM fields').all() as FieldRow[]
  const field = (section: string, fieldPath: string) =>
    db.prepare('SELECT * FROM fields WHERE section=? AND path=?').get(section, fieldPath) as
      FieldRow | undefined
  const values = (id: number) =>
    db.prepare('SELECT lang,value FROM field_values WHERE field_id=?').all(id) as ValueRow[]
  const mediaUrl = (value: string) => (value ? `${prefix}/api/media/${value}` : '')
  const order = () =>
    (
      db.prepare('SELECT key FROM sections WHERE reorderable=1 ORDER BY position').all() as {
        key: string
      }[]
    ).map((row) => row.key)
  api.get(
    '/sites/:site/content',
    wrap((req, res) => {
      const lang = req.query.lang ?? 'nl'
      if (!isLang(lang)) {
        res.status(400).json({ error: 'Unsupported language' })
        return
      }
      const sections = Object.fromEntries(
        SECTION_KEYS.map((key) => [key, {}]),
      ) as Content['sections']
      for (const row of fields()) {
        const all = values(row.id)
        const value =
          all.find((v) => v.lang === lang)?.value ?? all.find((v) => v.lang === 'nl')?.value ?? ''
        if (isSectionKey(row.section))
          sections[row.section][row.path] =
            row.type === 'image' || row.type === 'video' ? mediaUrl(value) : value
      }
      res.json({ lang, sections, order: order() })
    }),
  )
  api.get(
    '/sites/:site/sections',
    wrap((_req, res) => res.json({ order: order() })),
  )
  api.get(
    '/sites/:site/editor',
    requireAuth,
    wrap((_req, res) => {
      const sections = db.prepare('SELECT * FROM sections ORDER BY position').all() as {
        key: Section['key']
        position: number
        reorderable: number
      }[]
      res.json({
        sections: sections.map((s) => ({
          ...s,
          reorderable: !!s.reorderable,
          fields: fields()
            .filter((f) => f.section === s.key)
            .map((f) => ({
              path: f.path,
              type: f.type,
              values: Object.fromEntries(values(f.id).map((v) => [v.lang, v.value])),
            })),
        })),
      })
    }),
  )
  api.get(
    '/sites/:site/sections/:section/fields/:path/values',
    requireAuth,
    wrap((req, res) => {
      const row = field(String(req.params.section), String(req.params.path))
      if (!row) {
        res.status(404).json({ error: 'Unknown field' })
        return
      }
      res.json({ values: Object.fromEntries(values(row.id).map((v) => [v.lang, v.value])) })
    }),
  )
  api.put(
    '/sites/:site/sections/:section/fields/:path',
    requireAuth,
    wrap((req, res) => {
      const row = field(String(req.params.section), String(req.params.path))
      if (!row) {
        res.status(404).json({ error: 'Unknown field' })
        return
      }
      const { lang, value } = req.body ?? {}
      if (!isLang(lang) || typeof value !== 'string' || value.length > 10000) {
        res
          .status(400)
          .json({ error: 'Expected supported lang and string value (maximum 10000 characters)' })
        return
      }
      if (row.type === 'link' && !safeLink(value)) {
        res.status(400).json({ error: 'Use an HTTP(S), mailto, tel, section, or local page link' })
        return
      }
      if ((row.type === 'image' || row.type === 'video') && value) {
        if (!/^[1-9]\d*$/.test(value)) {
          res.status(400).json({ error: 'Select an existing media item' })
          return
        }
        const media = db.prepare('SELECT mime_type FROM media WHERE id=?').get(value) as
          { mime_type: string } | undefined
        if (
          !media ||
          !(row.type === 'image'
            ? media.mime_type.startsWith('image/')
            : media.mime_type === 'video/mp4')
        ) {
          res.status(400).json({ error: 'Media type does not match field' })
          return
        }
      }
      db.prepare(
        'INSERT INTO field_values VALUES (?,?,?) ON CONFLICT(field_id,lang) DO UPDATE SET value=excluded.value',
      ).run(row.id, lang, value)
      res.json({ ok: true })
    }),
  )
  api.put(
    '/sites/:site/sections/reorder',
    requireAuth,
    wrap((req, res) => {
      const requested: unknown = req.body?.order
      const current = order()
      if (
        !Array.isArray(requested) ||
        requested.length !== current.length ||
        new Set(requested).size !== current.length ||
        !requested.every((key) => typeof key === 'string' && current.includes(key))
      ) {
        res.status(400).json({ error: 'Provide every reorderable section exactly once' })
        return
      }
      db.transaction(() => {
        requested.forEach((key, i) =>
          db.prepare('UPDATE sections SET position=? WHERE key=?').run(i + 2, key),
        )
      })()
      res.json({ ok: true })
    }),
  )
  api.get(
    '/media',
    requireAuth,
    wrap((_req, res) => {
      const rows = db
        .prepare('SELECT id,filename,mime_type FROM media ORDER BY id DESC')
        .all() as Omit<MediaRow, 'data'>[]
      res.json(
        rows.map((r) => ({
          id: r.id,
          filename: r.filename,
          mimeType: r.mime_type,
          url: mediaUrl(String(r.id)),
        })),
      )
    }),
  )
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 60 * 1024 * 1024, files: 1 },
  })
  api.post(
    '/media',
    requireAuth,
    upload.single('file'),
    wrap((req, res) => {
      if (!req.file) {
        res.status(400).json({ error: 'Choose a file' })
        return
      }
      const b = req.file.buffer
      const mime = b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        ? 'image/png'
        : b[0] === 255 && b[1] === 216 && b[2] === 255
          ? 'image/jpeg'
          : b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP'
            ? 'image/webp'
            : b.toString('ascii', 4, 8) === 'ftyp' &&
                ['isom', 'iso2', 'mp41', 'mp42', 'avc1', 'M4V '].includes(
                  b.toString('ascii', 8, 12),
                )
              ? 'video/mp4'
              : null
      if (!mime) {
        res.status(400).json({ error: 'Supported uploads: PNG, JPEG, WebP and MP4 (up to 60 MB)' })
        return
      }
      const filename = path.basename(req.file.originalname).slice(0, 200)
      const id = addMedia(db, b, filename, mime)
      res.status(201).json({ id, filename, mimeType: mime, url: mediaUrl(String(id)) })
    }),
  )
  api.delete(
    '/media/:id',
    requireAuth,
    wrap((req, res) => {
      const used = db
        .prepare(
          "SELECT 1 FROM field_values v JOIN fields f ON f.id=v.field_id WHERE f.type IN ('image','video') AND v.value=?",
        )
        .get(req.params.id)
      if (used) {
        res
          .status(409)
          .json({ error: 'This media is in use. Replace its references before deleting it.' })
        return
      }
      const result = db.prepare('DELETE FROM media WHERE id=?').run(req.params.id)
      res
        .status(result.changes ? 200 : 404)
        .json(result.changes ? { ok: true } : { error: 'Media not found' })
    }),
  )
  api.get(
    '/media/:id',
    wrap((req, res) => {
      const row = db.prepare('SELECT mime_type,data FROM media WHERE id=?').get(req.params.id) as
        MediaRow | undefined
      if (!row) {
        res.status(404).json({ error: 'Media not found' })
        return
      }
      const size = row.data.length
      res.set('Content-Type', row.mime_type)
      res.set('Cache-Control', 'public,max-age=31536000,immutable')
      res.set('Accept-Ranges', 'bytes')
      const header = req.get('range')
      if (header) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(header)
        if (!match || (!match[1] && !match[2])) {
          res.status(416).set('Content-Range', `bytes */${size}`).end()
          return
        }
        const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]))
        const end = match[1]
          ? match[2]
            ? Math.min(size - 1, Number(match[2]))
            : size - 1
          : size - 1
        if (
          !Number.isSafeInteger(start) ||
          !Number.isSafeInteger(end) ||
          start > end ||
          start >= size
        ) {
          res.status(416).set('Content-Range', `bytes */${size}`).end()
          return
        }
        res
          .status(206)
          .set('Content-Range', `bytes ${start}-${end}/${size}`)
          .set('Content-Length', String(end - start + 1))
          .send(row.data.subarray(start, end + 1))
        return
      }
      res.set('Content-Length', String(size)).send(row.data)
    }),
  )
  api.use((_req, res) => res.status(404).json({ error: 'API route not found' }))
  app.use(`${prefix}/api`, api)
  app.use(prefix || '/', express.static(distDir, { index: false }))
  app.get(
    [
      prefix || '/',
      `${prefix}/admin`,
      `${prefix}/products`,
      ...LEGAL_PATHS.map((route) => `${prefix}${route}`),
      ...AUDIENCE_PATHS.map((route) => `${prefix}${route}`),
      ...PRODUCTS.map((product) => `${prefix}/products/${product.slug}`),
    ],
    (_req, res) => res.sendFile(path.join(distDir, 'index.html')),
  )
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof multer.MulterError) {
      res
        .status(400)
        .json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'File exceeds 60 MB' : error.message })
      return
    }
    if (error instanceof SyntaxError) {
      res.status(400).json({ error: 'Invalid JSON' })
      return
    }
    console.error('Request failed:', error instanceof Error ? error.message : 'Unknown error')
    res.status(500).json({ error: 'Request failed. Please try again.' })
  })
  return app
}
