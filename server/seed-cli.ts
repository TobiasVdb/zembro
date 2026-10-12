import 'dotenv/config'
import path from 'node:path'
import { openDatabase, seedDatabase } from './db.js'
const db = openDatabase(path.resolve(process.env.DATA_DIR || 'data'))
seedDatabase(db, path.resolve('public/assets'))
db.close()
console.log('Seed complete; existing content preserved.')
