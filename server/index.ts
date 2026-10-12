import 'dotenv/config'
import path from 'node:path'
import { openDatabase, seedDatabase } from './db.js'
import { createApp } from './app.js'
const db = openDatabase(path.resolve(process.env.DATA_DIR || 'data'))
seedDatabase(db, path.resolve('public/assets'))
const production = process.env.NODE_ENV === 'production'
if (production && !process.env.PUBLIC_ORIGIN)
  throw new Error('PUBLIC_ORIGIN is required in production')
const server = createApp({
  db,
  password: process.env.EDITOR_PASSWORD || '',
  origin: process.env.PUBLIC_ORIGIN || 'http://localhost:5173',
  basePath: process.env.BASE_PATH,
  production,
}).listen(Number(process.env.PORT || 8788), process.env.HOST || '127.0.0.1', () =>
  console.log(`Zembro API: http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 8788}`),
)
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () =>
    server.close(() => {
      db.close()
      process.exit(0)
    }),
  )
