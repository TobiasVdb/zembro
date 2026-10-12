import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { once } from 'node:events'
import type { Server } from 'node:http'
import { createApp } from './app.js'
import { addMedia, openDatabase, seedDatabase } from './db.js'
import { initialAmbientBodies, seedContent } from './content.js'
import { PRODUCTS, type Content, type MediaItem } from '../shared/types.js'
import { localHref } from '../shared/routes.js'
import { legalSource } from './legal-source.js'
import { parseLegalBody, parseLegalInline } from '../shared/legal.js'
const password = 'test-only-editor-password'
const origin = 'http://localhost:5173'
test('Zembro CMS API behavior', async (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'zembro-tests-'))
  let db = openDatabase(dir)
  seedDatabase(db, path.resolve('public/assets'))
  const distDir = path.join(dir, 'frontend')
  mkdirSync(distDir)
  writeFileSync(path.join(distDir, 'index.html'), '<!doctype html><title>Zembro test</title>')
  const server = createApp({ db, password, origin, distDir }).listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const url = `http://127.0.0.1:${address.port}/api`
  let cookie = ''
  const request = (
    route: string,
    method = 'GET',
    body?: unknown,
    extra: Record<string, string> = {},
  ) =>
    fetch(url + route, {
      method,
      headers: { origin, 'content-type': 'application/json', cookie, ...extra },
      ...(body === undefined || method === 'GET' || method === 'HEAD'
        ? {}
        : { body: JSON.stringify(body) }),
    })
  const field = '/sites/zembro/sections/hero/fields/title'
  try {
    await t.test('health, language content and unknown site validation', async () => {
      assert.equal((await request('/health')).status, 200)
      for (const lang of ['nl', 'en', 'fr', 'de']) {
        const res = await request(`/sites/zembro/content?lang=${lang}`)
        assert.equal(res.status, 200)
        const data = (await res.json()) as Content
        assert.equal(data.lang, lang)
        assert.ok(data.sections.hero.title)
        assert.equal(data.order.length, 4)
      }
      assert.equal((await request('/sites/zembro/content?lang=es')).status, 400)
      assert.equal((await request('/sites/other/content')).status, 404)
    })
    await t.test('anonymous edits and administration are rejected', async () => {
      assert.equal((await request(field, 'PUT', { lang: 'nl', value: 'No' })).status, 401)
      assert.equal((await request('/media')).status, 401)
      assert.equal((await request('/sites/zembro/editor')).status, 401)
      assert.equal((await request(field + '/values')).status, 401)
    })
    await t.test(
      'catalogue translations, local detail routes and purchase destinations',
      async () => {
        for (const lang of ['nl', 'en', 'fr', 'de']) {
          const data = (await (
            await request(`/sites/zembro/content?lang=${lang}`)
          ).json()) as Content
          assert.ok(data.sections.catalog.title)
          assert.match(data.sections.catalog.heroImage, /^\/api\/media\/\d+$/)
          assert.ok(data.sections.catalog.heroImageAlt)
          for (const product of PRODUCTS) {
            const fields = data.sections[product.section]
            assert.ok(fields.body && fields.details && fields.features && fields.imageAlt)
            assert.match(fields.image, /^\/api\/media\/\d+$/)
            assert.equal(new URL(fields.shopLink).hostname, 'zembro.com')
            const response = await fetch(
              url.replace(/\/api$/, '') + `/products/${product.slug}?lang=${lang}`,
            )
            assert.equal(response.status, 200)
            assert.match(await response.text(), /Zembro test/)
          }
        }
        assert.equal((await fetch(url.replace(/\/api$/, '') + '/products')).status, 200)
        assert.equal((await fetch(url.replace(/\/api$/, '') + '/products/unknown')).status, 404)
        assert.equal(
          localHref('/products/mini', '/preview', '?campaign=test&lang=nl', 'de'),
          '/preview/products/mini?campaign=test&lang=de',
        )
        assert.equal(localHref('/#technology', '', '?lang=en', 'en'), '/?lang=en#technology')
      },
    )
    await t.test(
      'local legal pages preserve published policies and localized footer links',
      async () => {
        for (const lang of ['nl', 'en', 'fr', 'de'] as const) {
          const data = (await (
            await request(`/sites/zembro/content?lang=${lang}`)
          ).json()) as Content
          for (const [section, source, route] of [
            ['legalPrivacy', 'privacy-policy', '/privacy'],
            ['legalTerms', 'terms-of-service', '/terms'],
          ] as const) {
            const fields = data.sections[section]
            const bodyFields = Object.keys(fields)
              .filter((key) => /^body\d+$/.test(key))
              .sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)))
            const body = bodyFields
              .map((key) => fields[key])
              .filter(Boolean)
              .join('\n\n')
            assert.equal(body, legalSource[source][lang === 'de' ? 'nl' : lang].body)
            assert.ok(bodyFields.every((key) => fields[key].length <= 10000))
            assert.equal(fields.sourceLanguage, lang === 'de' ? 'nl' : lang)
            assert.equal(!!fields.notice, lang === 'de')
            assert.equal(
              (await fetch(url.replace(/\/api$/, '') + `${route}?lang=${lang}`)).status,
              200,
            )
          }
          assert.equal(data.sections.footer.privacyLink, '/privacy')
          assert.equal(data.sections.footer.termsLink, '/terms')
        }
        assert.equal(
          (
            await request('/sites/zembro/sections/legalPrivacy/fields/body1', 'PUT', {
              lang: 'en',
              value: 'unauthorized',
            })
          ).status,
          401,
        )
        assert.equal(
          localHref('/privacy', '/preview', '?campaign=test&lang=nl', 'fr'),
          '/preview/privacy?campaign=test&lang=fr',
        )
        assert.ok(
          parseLegalBody(legalSource['privacy-policy'].en.body).some(
            (block) => block.kind === 'table',
          ),
        )
        assert.deepEqual(parseLegalBody('****\n\n## Title\n\nBody'), [
          { kind: 'heading', text: 'Title' },
          { kind: 'paragraph', text: 'Body' },
        ])
        for (const lang of ['nl', 'fr'] as const) {
          const privacyBlocks = parseLegalBody(legalSource['privacy-policy'][lang].body)
          assert.deepEqual(
            privacyBlocks.slice(-2).map((block) => block.kind),
            ['heading', 'paragraph'],
          )
          const contactHeading = privacyBlocks.at(-2)
          const address = privacyBlocks.at(-1)
          assert.ok(
            contactHeading?.kind === 'heading' && contactHeading.text === 'Zembro Customer Service',
          )
          assert.ok(address?.kind === 'paragraph' && address.text.split('\n').length === 3)
          assert.ok(address?.kind === 'paragraph' && address.text.includes('Geldenaaksebaan 329'))
        }
        assert.deepEqual(parseLegalBody('****\n\n## **Title**\n\nBody'), [
          { kind: 'heading', text: '**Title**' },
          { kind: 'paragraph', text: 'Body' },
        ])
        const termsHeadings = parseLegalBody(legalSource['terms-of-service'].en.body)
          .filter((block) => block.kind === 'heading')
          .map((block) => block.text)
        for (let number = 1; number <= 20; number++) {
          assert.ok(termsHeadings.some((heading) => heading.includes(`SECTION ${number} -`)))
        }
        assert.deepEqual(parseLegalBody('**Title\n\n**\n\nBody'), [
          { kind: 'heading', text: 'Title' },
          { kind: 'paragraph', text: 'Body' },
        ])
        assert.deepEqual(parseLegalBody('**\n\nTitle**\n\nBody'), [
          { kind: 'heading', text: 'Title' },
          { kind: 'paragraph', text: 'Body' },
        ])
        assert.deepEqual(parseLegalInline('[unsafe](javascript:alert) **Strong**'), [
          { kind: 'text', text: 'unsafe' },
          { kind: 'text', text: ' ' },
          { kind: 'strong', text: 'Strong' },
        ])
      },
    )
    await t.test(
      'audience pages have translated content, local routes and protected fields',
      async () => {
        for (const lang of ['nl', 'en', 'fr', 'de']) {
          const data = (await (
            await request(`/sites/zembro/content?lang=${lang}`)
          ).json()) as Content
          assert.ok(data.sections.header.lovedOnes)
          assert.equal(data.sections.header.lovedOnesLink, '/for-loved-ones')
          assert.equal(data.sections.header.professionalLink, '/for-care-providers')
          for (const [section, route] of [
            ['lovedOnes', '/for-loved-ones'],
            ['careProviders', '/for-care-providers'],
          ] as const) {
            const values = data.sections[section]
            for (const key of [
              'title',
              'accent',
              'body',
              'question1Body',
              'question2Body',
              'question3Body',
              'immediateBody',
              'proactiveBody',
              'setupNote',
            ])
              assert.ok(values[key])
            assert.match(values.image, /^\/api\/media\/\d+$/)
            assert.equal(
              (await fetch(url.replace(/\/api$/, '') + `${route}?lang=${lang}`)).status,
              200,
            )
            assert.ok(!data.order.includes(section))
          }
        }
        assert.equal(
          (
            await request('/sites/zembro/sections/lovedOnes/fields/title', 'PUT', {
              lang: 'en',
              value: 'No',
            })
          ).status,
          401,
        )
        assert.equal(
          localHref('/for-care-providers', '/preview', '?campaign=care&lang=nl', 'de'),
          '/preview/for-care-providers?campaign=care&lang=de',
        )
      },
    )
    await t.test('login, cookies and same-origin writes', async () => {
      assert.equal((await request('/auth/login', 'POST', { password: 'wrong' })).status, 401)
      assert.equal(
        (await request('/auth/login', 'POST', { password }, { origin: 'https://outside.example' }))
          .status,
        403,
      )
      const res = await request('/auth/login', 'POST', { password })
      assert.equal(res.status, 200)
      const header = res.headers.get('set-cookie')
      assert.ok(header)
      assert.ok(header.includes('HttpOnly'))
      assert.ok(header.includes('SameSite=Strict'))
      cookie = header.split(';')[0]
      assert.equal((await (await request('/auth/session')).json()).authenticated, true)
      assert.equal(
        (
          await request(
            field,
            'PUT',
            { lang: 'nl', value: 'No' },
            { origin: 'https://outside.example' },
          )
        ).status,
        403,
      )
    })
    await t.test('translations persist; missing falls back and empty remains empty', async () => {
      assert.equal(
        (await request(field, 'PUT', { lang: 'en', value: 'Independent, tested.' })).status,
        200,
      )
      let data = (await (await request('/sites/zembro/content?lang=en')).json()) as Content
      assert.equal(data.sections.hero.title, 'Independent, tested.')
      assert.equal((await request(field, 'PUT', { lang: 'fr', value: '' })).status, 200)
      data = (await (await request('/sites/zembro/content?lang=fr')).json()) as Content
      assert.equal(data.sections.hero.title, '')
      db.prepare(
        "DELETE FROM field_values WHERE lang='de' AND field_id=(SELECT id FROM fields WHERE section='hero' AND path='title')",
      ).run()
      data = (await (await request('/sites/zembro/content?lang=de')).json()) as Content
      assert.equal(data.sections.hero.title, 'Zelfstandig.')
    })
    await t.test(
      'product fields share authenticated editing, fallback and link validation',
      async () => {
        const route = '/sites/zembro/sections/productMini/fields/body'
        assert.equal(
          (await request(route, 'PUT', { lang: 'fr', value: 'Mini, texte enregistré.' })).status,
          200,
        )
        assert.equal(
          (await (await request('/sites/zembro/content?lang=fr')).json()).sections.productMini.body,
          'Mini, texte enregistré.',
        )
        const link = '/sites/zembro/sections/wearable/fields/link'
        assert.equal(
          (await request(link, 'PUT', { lang: 'en', value: '/products/mini' })).status,
          200,
        )
        assert.equal(
          (await request(link, 'PUT', { lang: 'en', value: '//outside.example' })).status,
          400,
        )
        assert.equal(
          (await request(link, 'PUT', { lang: 'en', value: '/products/unknown' })).status,
          400,
        )
      },
    )
    await t.test('field types, unsafe links, missing media and invalid input', async () => {
      assert.equal((await request(field, 'PUT', { lang: 'xx', value: 'x' })).status, 400)
      assert.equal((await request(field, 'PUT', { lang: 'nl', value: 12 })).status, 400)
      assert.equal(
        (await request(field, 'PUT', { lang: 'nl', value: 'x'.repeat(10001) })).status,
        400,
      )
      assert.equal(
        (
          await request('/sites/zembro/sections/hero/fields/missing', 'PUT', {
            lang: 'nl',
            value: 'x',
          })
        ).status,
        404,
      )
      assert.equal(
        (
          await request('/sites/zembro/sections/header/fields/contactLink', 'PUT', {
            lang: 'nl',
            value: 'javascript:alert(1)',
          })
        ).status,
        400,
      )
      assert.equal(
        (
          await request('/sites/zembro/sections/hero/fields/image', 'PUT', {
            lang: 'nl',
            value: '999999',
          })
        ).status,
        400,
      )
      const data = (await (await request('/sites/zembro/content')).json()) as Content
      const videoId = data.sections.hero.video.split('/').pop()
      assert.equal(
        (
          await request('/sites/zembro/sections/hero/fields/image', 'PUT', {
            lang: 'nl',
            value: videoId,
          })
        ).status,
        400,
      )
    })
    await t.test('section reordering is complete, transactional and persistent', async () => {
      const route = '/sites/zembro/sections/reorder'
      assert.equal((await request(route, 'PUT', { order: ['ambient'] })).status, 400)
      assert.equal(
        (await request(route, 'PUT', { order: ['ambient', 'ambient', 'platform', 'impact'] }))
          .status,
        400,
      )
      assert.equal(
        (await request(route, 'PUT', { order: ['hero', 'wearable', 'platform', 'impact'] })).status,
        400,
      )
      const before = await (await request('/sites/zembro/sections')).json()
      assert.deepEqual(before.order, ['wearable', 'ambient', 'platform', 'impact'])
      const order = ['impact', 'platform', 'ambient', 'wearable']
      assert.equal((await request(route, 'PUT', { order })).status, 200)
      assert.deepEqual((await (await request('/sites/zembro/sections')).json()).order, order)
    })
    await t.test(
      'media references cannot be deleted; videos support real byte ranges',
      async () => {
        const data = (await (await request('/sites/zembro/content')).json()) as Content
        const video = data.sections.hero.video.replace('/api', '')
        const full = await request(video)
        assert.equal(full.status, 200)
        const bytes = new Uint8Array(await full.arrayBuffer())
        assert.ok(bytes.length > 100)
        const range = await request(video, 'GET', undefined, { range: 'bytes=0-99' })
        assert.equal(range.status, 206)
        assert.equal((await range.arrayBuffer()).byteLength, 100)
        const suffix = await request(video, 'GET', undefined, { range: 'bytes=-10' })
        assert.equal(suffix.status, 206)
        assert.deepEqual(new Uint8Array(await suffix.arrayBuffer()), bytes.slice(-10))
        assert.equal(
          (await request(video, 'GET', undefined, { range: `bytes=${bytes.length}-` })).status,
          416,
        )
        assert.equal((await request(video, 'GET', undefined, { range: 'bytes=-0' })).status, 416)
        assert.equal((await request(video, 'DELETE')).status, 409)
      },
    )
    await t.test('uploads validate file bytes; unused uploads can be removed', async () => {
      const upload = async (bytes: Buffer, name: string, type: string) => {
        const body = new FormData()
        body.append('file', new Blob([new Uint8Array(bytes)], { type }), name)
        return fetch(url + '/media', { method: 'POST', headers: { origin, cookie }, body })
      }
      assert.equal(
        (await upload(Buffer.from('<script>bad</script>'), 'bad.png', 'image/png')).status,
        400,
      )
      const png = readFileSync('public/assets/logo.png')
      const extra = Buffer.concat([png, Buffer.from('test-only')])
      const res = await upload(extra, 'test.png', 'image/png')
      assert.equal(res.status, 201)
      const item = (await res.json()) as MediaItem
      assert.equal((await request(`/media/${item.id}`)).status, 200)
      assert.equal((await request(`/media/${item.id}`, 'DELETE')).status, 200)
      assert.equal((await request(`/media/${item.id}`)).status, 404)
    })
    await t.test('legal CMS blocks save and local legal destinations validate', async () => {
      const route = '/sites/zembro/sections/legalTerms/fields/body1'
      const value = legalSource['terms-of-service'].nl.body.slice(0, 8000)
      assert.equal((await request(route, 'PUT', { lang: 'nl', value })).status, 200)
      const data = (await (await request('/sites/zembro/content?lang=nl')).json()) as Content
      assert.equal(data.sections.legalTerms.body1, value)
      assert.equal(
        (await request(route, 'PUT', { lang: 'en', value: 'x'.repeat(10001) })).status,
        400,
      )
      const link = '/sites/zembro/sections/footer/fields/privacyLink'
      assert.equal((await request(link, 'PUT', { lang: 'nl', value: '/privacy' })).status, 200)
      assert.equal(
        (await request(link, 'PUT', { lang: 'nl', value: '/unapproved-page' })).status,
        400,
      )
    })
    await t.test(
      'audience copy and menu destinations support authenticated CMS editing',
      async () => {
        const route = '/sites/zembro/sections/careProviders/fields/responseTitle'
        assert.equal(
          (await request(route, 'PUT', { lang: 'en', value: 'Edited care workflow' })).status,
          200,
        )
        assert.equal(
          (await (await request('/sites/zembro/content?lang=en')).json()).sections.careProviders
            .responseTitle,
          'Edited care workflow',
        )
        for (const value of ['/for-loved-ones', '/for-care-providers'])
          assert.equal(
            (
              await request('/sites/zembro/sections/header/fields/lovedOnesLink', 'PUT', {
                lang: 'en',
                value,
              })
            ).status,
            200,
          )
      },
    )
    await t.test('seeding and database reopening preserve edits', async () => {
      seedDatabase(db, path.resolve('public/assets'))
      assert.equal(
        (await (await request('/sites/zembro/content?lang=en')).json()).sections.hero.title,
        'Independent, tested.',
      )
      const count = db.prepare('SELECT count(*) AS count FROM media').get()
      db.close()
      db = openDatabase(dir)
      seedDatabase(db, path.resolve('public/assets'))
      assert.deepEqual(db.prepare('SELECT count(*) AS count FROM media').get(), count)
      const row = db
        .prepare(
          "SELECT value FROM field_values WHERE lang='en' AND field_id=(SELECT id FROM fields WHERE section='hero' AND path='title')",
        )
        .get() as { value: string }
      assert.equal(row.value, 'Independent, tested.')
    })
    await t.test(
      'product migration upgrades v1 databases and preserves custom links and edits',
      () => {
        const migrationDir = mkdtempSync(path.join(tmpdir(), 'zembro-migration-'))
        const previous = openDatabase(migrationDir)
        try {
          seedDatabase(previous, path.resolve('public/assets'))
          previous.exec(`DELETE FROM field_values WHERE field_id IN (SELECT id FROM fields WHERE section='catalog' OR section LIKE 'product%');
          DELETE FROM fields WHERE section='catalog' OR section LIKE 'product%';
          DELETE FROM sections WHERE key='catalog' OR key LIKE 'product%';
          DELETE FROM settings WHERE key='seed-v2-products';
          UPDATE field_values SET value='Custom hero' WHERE field_id=(SELECT id FROM fields WHERE section='hero' AND path='title');
          UPDATE field_values SET value='https://example.com/custom' WHERE field_id=(SELECT id FROM fields WHERE section='wearable' AND path='watchLink');`)
          seedDatabase(previous, path.resolve('public/assets'))
          const value = (section: string, key: string) =>
            previous
              .prepare(
                `SELECT value FROM field_values WHERE lang='en' AND field_id=(SELECT id FROM fields WHERE section=? AND path=?)`,
              )
              .get(section, key)
          assert.deepEqual(value('hero', 'title'), { value: 'Custom hero' })
          assert.deepEqual(value('wearable', 'watchLink'), { value: 'https://example.com/custom' })
          assert.deepEqual(value('productMini', 'name'), { value: 'Zembro Mini' })
          previous
            .prepare(
              `UPDATE field_values SET value='Edited product' WHERE field_id=(SELECT id FROM fields WHERE section='productMini' AND path='name')`,
            )
            .run()
          seedDatabase(previous, path.resolve('public/assets'))
          assert.deepEqual(value('productMini', 'name'), { value: 'Edited product' })
        } finally {
          previous.close()
          rmSync(migrationDir, { recursive: true, force: true })
        }
      },
    )
    await t.test(
      'ambient migration updates defaults while preserving edited text and media',
      () => {
        const migrationDir = mkdtempSync(path.join(tmpdir(), 'zembro-ambient-'))
        const previous = openDatabase(migrationDir)
        try {
          seedDatabase(previous, path.resolve('public/assets'))
          const original = addMedia(
            previous,
            readFileSync('public/assets/sensor.webp'),
            'sensor.webp',
            'image/webp',
          )
          const set = previous.prepare(`UPDATE field_values SET value=? WHERE lang=? AND field_id=(
          SELECT id FROM fields WHERE section='ambient' AND path=?)`)
          const get = (lang: string, field: string) =>
            previous
              .prepare(
                `SELECT value FROM field_values
          WHERE lang=? AND field_id=(SELECT id FROM fields WHERE section='ambient' AND path=?)`,
              )
              .get(lang, field)
          set.run(initialAmbientBodies.en, 'en', 'body')
          set.run('Custom French copy', 'fr', 'body')
          set.run(String(original), 'en', 'image')
          // A different existing asset represents an editor-selected image.
          const custom = previous
            .prepare("SELECT id FROM media WHERE filename='hero.webp'")
            .get() as { id: number }
          set.run(String(custom.id), 'fr', 'image')
          previous.prepare("DELETE FROM settings WHERE key='seed-v4-ambient'").run()
          seedDatabase(previous, path.resolve('public/assets'))
          assert.deepEqual(get('en', 'body'), {
            value: seedContent.ambient.find((field) => field.path === 'body')?.values.en,
          })
          assert.deepEqual(get('fr', 'body'), { value: 'Custom French copy' })
          assert.notDeepEqual(get('en', 'image'), { value: String(original) })
          assert.deepEqual(get('fr', 'image'), { value: String(custom.id) })
          set.run('Later edit', 'en', 'body')
          seedDatabase(previous, path.resolve('public/assets'))
          assert.deepEqual(get('en', 'body'), { value: 'Later edit' })
        } finally {
          previous.close()
          rmSync(migrationDir, { recursive: true, force: true })
        }
      },
    )
    await t.test('corner render migration preserves editor media and descriptions', () => {
      const migrationDir = mkdtempSync(path.join(tmpdir(), 'zembro-corner-'))
      const previous = openDatabase(migrationDir)
      try {
        seedDatabase(previous, path.resolve('public/assets'))
        const original = addMedia(
          previous,
          readFileSync('public/assets/sensor-clean.webp'),
          'sensor-clean.webp',
          'image/webp',
        )
        const custom = previous
          .prepare("SELECT id FROM media WHERE filename='hero.webp'")
          .get() as { id: number }
        const set = previous.prepare(`UPDATE field_values SET value=? WHERE lang=? AND field_id=(
          SELECT id FROM fields WHERE section='ambient' AND path=?)`)
        const get = (lang: string, field: string) =>
          previous
            .prepare(
              `SELECT value FROM field_values
          WHERE lang=? AND field_id=(SELECT id FROM fields WHERE section='ambient' AND path=?)`,
            )
            .get(lang, field)
        set.run(String(original), 'en', 'image')
        set.run(String(custom.id), 'fr', 'image')
        set.run('Silver Shield sensor for discreet ambient monitoring', 'en', 'imageAlt')
        set.run('Custom description', 'fr', 'imageAlt')
        previous.prepare("DELETE FROM settings WHERE key='seed-v5-corner-render'").run()
        seedDatabase(previous, path.resolve('public/assets'))
        const render = previous
          .prepare("SELECT id FROM media WHERE filename='silver-shield-corner.webp'")
          .get() as { id: number }
        assert.deepEqual(get('en', 'image'), { value: String(render.id) })
        assert.deepEqual(get('fr', 'image'), { value: String(custom.id) })
        assert.deepEqual(get('en', 'imageAlt'), {
          value: seedContent.ambient.find((field) => field.path === 'imageAlt')?.values.en,
        })
        assert.deepEqual(get('fr', 'imageAlt'), { value: 'Custom description' })
        set.run('Later description', 'en', 'imageAlt')
        seedDatabase(previous, path.resolve('public/assets'))
        assert.deepEqual(get('en', 'imageAlt'), { value: 'Later description' })
      } finally {
        previous.close()
        rmSync(migrationDir, { recursive: true, force: true })
      }
    })
    await t.test('dark corner migration adds translated media without overwriting edits', () => {
      const migrationDir = mkdtempSync(path.join(tmpdir(), 'zembro-dark-corner-'))
      const previous = openDatabase(migrationDir)
      try {
        seedDatabase(previous, path.resolve('public/assets'))
        const light = previous
          .prepare(
            "SELECT * FROM field_values WHERE field_id=(SELECT id FROM fields WHERE section='ambient' AND path='image')",
          )
          .all()
        // Simulate an existing installation before the additive dark-image migration.
        previous
          .prepare(
            "DELETE FROM field_values WHERE field_id=(SELECT id FROM fields WHERE section='ambient' AND path='imageDark')",
          )
          .run()
        previous.prepare("DELETE FROM fields WHERE section='ambient' AND path='imageDark'").run()
        previous.prepare("DELETE FROM settings WHERE key='seed-v6-dark-corner'").run()
        seedDatabase(previous, path.resolve('public/assets'))
        const field = previous
          .prepare("SELECT id,type FROM fields WHERE section='ambient' AND path='imageDark'")
          .get() as { id: number; type: string }
        const render = previous
          .prepare("SELECT id FROM media WHERE filename='silver-shield-corner-dark.webp'")
          .get() as { id: number }
        assert.equal(field.type, 'image')
        assert.deepEqual(
          previous
            .prepare('SELECT lang,value FROM field_values WHERE field_id=? ORDER BY lang')
            .all(field.id),
          ['de', 'en', 'fr', 'nl'].map((lang) => ({ lang, value: String(render.id) })),
        )
        assert.deepEqual(
          previous
            .prepare(
              "SELECT * FROM field_values WHERE field_id=(SELECT id FROM fields WHERE section='ambient' AND path='image')",
            )
            .all(),
          light,
        )
        const custom = previous
          .prepare("SELECT id FROM media WHERE filename='hero.webp'")
          .get() as { id: number }
        previous
          .prepare("UPDATE field_values SET value=? WHERE field_id=? AND lang='en'")
          .run(String(custom.id), field.id)
        previous.prepare("DELETE FROM settings WHERE key='seed-v6-dark-corner'").run()
        seedDatabase(previous, path.resolve('public/assets'))
        assert.deepEqual(
          previous
            .prepare("SELECT value FROM field_values WHERE field_id=? AND lang='en'")
            .get(field.id),
          { value: String(custom.id) },
        )
      } finally {
        previous.close()
        rmSync(migrationDir, { recursive: true, force: true })
      }
    })
    await t.test(
      'revised sensor geometry upgrades both default renders and preserves custom media',
      () => {
        const migrationDir = mkdtempSync(path.join(tmpdir(), 'zembro-geometry-'))
        const previous = openDatabase(migrationDir)
        try {
          seedDatabase(previous, path.resolve('public/assets'))
          const custom = previous
            .prepare("SELECT id FROM media WHERE filename='hero.webp'")
            .get() as { id: number }
          const set = previous.prepare(`UPDATE field_values SET value=? WHERE lang=? AND field_id=(
          SELECT id FROM fields WHERE section='ambient' AND path=?)`)
          for (const [field, oldFile] of [
            ['image', 'silver-shield-corner.webp'],
            ['imageDark', 'silver-shield-corner-dark.webp'],
          ]) {
            const old = addMedia(
              previous,
              readFileSync(path.join('public/assets', oldFile)),
              oldFile,
              'image/webp',
            )
            set.run(String(old), 'en', field)
            set.run(String(custom.id), 'fr', field)
          }
          previous.prepare("DELETE FROM settings WHERE key='seed-v7-sensor-geometry'").run()
          seedDatabase(previous, path.resolve('public/assets'))
          for (const [field, newFile] of [
            ['image', 'silver-shield-corner-v2.webp'],
            ['imageDark', 'silver-shield-corner-dark-v2.webp'],
          ]) {
            const media = previous
              .prepare('SELECT id FROM media WHERE filename=?')
              .get(newFile) as { id: number }
            const get = (lang: string) =>
              previous
                .prepare(
                  `SELECT value FROM field_values WHERE lang=?
            AND field_id=(SELECT id FROM fields WHERE section='ambient' AND path=?)`,
                )
                .get(lang, field)
            assert.deepEqual(get('en'), { value: String(media.id) })
            assert.deepEqual(get('fr'), { value: String(custom.id) })
            set.run(String(custom.id), 'en', field)
            seedDatabase(previous, path.resolve('public/assets'))
            assert.deepEqual(get('en'), { value: String(custom.id) })
          }
        } finally {
          previous.close()
          rmSync(migrationDir, { recursive: true, force: true })
        }
      },
    )
    await t.test(
      'reverse view upgrades both themes and preserves custom and empty selections',
      () => {
        const migrationDir = mkdtempSync(path.join(tmpdir(), 'zembro-reverse-'))
        const previous = openDatabase(migrationDir)
        try {
          seedDatabase(previous, path.resolve('public/assets'))
          const custom = previous
            .prepare("SELECT id FROM media WHERE filename='hero.webp'")
            .get() as {
            id: number
          }
          const set = previous.prepare(`UPDATE field_values SET value=? WHERE lang=? AND field_id=(
          SELECT id FROM fields WHERE section='ambient' AND path=?)`)
          for (const [field, oldFile] of [
            ['image', 'silver-shield-corner-v2.webp'],
            ['imageDark', 'silver-shield-corner-dark-v2.webp'],
          ]) {
            const old = addMedia(
              previous,
              readFileSync(path.join('public/assets', oldFile)),
              oldFile,
              'image/webp',
            )
            set.run(String(old), 'nl', field)
            set.run(String(old), 'en', field)
            set.run(String(custom.id), 'fr', field)
            set.run('', 'de', field)
          }
          previous.prepare("DELETE FROM settings WHERE key='seed-v8-reverse-view'").run()
          seedDatabase(previous, path.resolve('public/assets'))
          for (const [field, newFile] of [
            ['image', 'silver-shield-reverse.webp'],
            ['imageDark', 'silver-shield-reverse-dark.webp'],
          ]) {
            const media = previous
              .prepare('SELECT id FROM media WHERE filename=?')
              .get(newFile) as {
              id: number
            }
            const get = (lang: string) =>
              previous
                .prepare(
                  `SELECT value FROM field_values WHERE lang=?
            AND field_id=(SELECT id FROM fields WHERE section='ambient' AND path=?)`,
                )
                .get(lang, field)
            assert.deepEqual(get('nl'), { value: String(media.id) })
            assert.deepEqual(get('en'), { value: String(media.id) })
            assert.deepEqual(get('fr'), { value: String(custom.id) })
            assert.deepEqual(get('de'), { value: '' })
            set.run(String(custom.id), 'en', field)
            seedDatabase(previous, path.resolve('public/assets'))
            assert.deepEqual(get('en'), { value: String(custom.id) })
          }
        } finally {
          previous.close()
          rmSync(migrationDir, { recursive: true, force: true })
        }
      },
    )
    await t.test(
      'audience migration preserves existing pages, custom links and audience edits',
      () => {
        const audienceDir = mkdtempSync(path.join(tmpdir(), 'zembro-audiences-'))
        const previous = openDatabase(audienceDir)
        try {
          seedDatabase(previous, path.resolve('public/assets'))
          previous.exec(`DELETE FROM field_values WHERE field_id IN (SELECT id FROM fields WHERE section IN ('lovedOnes','careProviders') OR (section='header' AND path IN ('lovedOnes','lovedOnesLink')));
          DELETE FROM fields WHERE section IN ('lovedOnes','careProviders') OR (section='header' AND path IN ('lovedOnes','lovedOnesLink'));
          DELETE FROM sections WHERE key IN ('lovedOnes','careProviders');
          DELETE FROM settings WHERE key='seed-v11-audiences';`)
          const set = previous.prepare(
            `UPDATE field_values SET value=? WHERE lang=? AND field_id=(SELECT id FROM fields WHERE section=? AND path=?)`,
          )
          const get = (section: string, field: string, lang = 'nl') =>
            previous
              .prepare(
                `SELECT value FROM field_values WHERE lang=? AND field_id=(SELECT id FROM fields WHERE section=? AND path=?)`,
              )
              .get(lang, section, field) as { value: string }
          set.run('Existing hero edit', 'nl', 'hero', 'title')
          set.run('https://zembro.com/nl/pages/sales', 'nl', 'header', 'professionalLink')
          set.run('https://example.com/custom', 'fr', 'header', 'professionalLink')
          seedDatabase(previous, path.resolve('public/assets'))
          assert.equal(get('header', 'professionalLink').value, '/for-care-providers')
          assert.equal(get('header', 'professionalLink', 'fr').value, 'https://example.com/custom')
          assert.equal(get('hero', 'title').value, 'Existing hero edit')
          for (const section of ['lovedOnes', 'careProviders']) {
            assert.deepEqual(
              previous.prepare('SELECT reorderable FROM sections WHERE key=?').get(section),
              { reorderable: 0 },
            )
            set.run('Edited audience title', 'en', section, 'title')
            set.run('', 'de', section, 'image')
          }
          previous.prepare("DELETE FROM settings WHERE key='seed-v11-audiences'").run()
          seedDatabase(previous, path.resolve('public/assets'))
          seedDatabase(previous, path.resolve('public/assets'))
          for (const section of ['lovedOnes', 'careProviders']) {
            assert.equal(get(section, 'title', 'en').value, 'Edited audience title')
            assert.equal(get(section, 'image', 'de').value, '')
          }
        } finally {
          previous.close()
          rmSync(audienceDir, { recursive: true, force: true })
        }
      },
    )
    await t.test('products hero migration adds media and preserves edited selections', () => {
      const heroDir = mkdtempSync(path.join(tmpdir(), 'zembro-products-hero-'))
      const previous = openDatabase(heroDir)
      try {
        seedDatabase(previous, path.resolve('public/assets'))
        previous.exec(`DELETE FROM field_values WHERE field_id IN (
          SELECT id FROM fields WHERE section='catalog' AND path IN ('heroImage','heroImageAlt'));
          DELETE FROM fields WHERE section='catalog' AND path IN ('heroImage','heroImageAlt');
          DELETE FROM settings WHERE key='seed-v10-products-hero';`)
        const set = previous.prepare(`UPDATE field_values SET value=? WHERE lang=? AND field_id=(
          SELECT id FROM fields WHERE section='catalog' AND path=?)`)
        const get = (field: string, lang = 'nl') =>
          previous
            .prepare(
              `SELECT value FROM field_values
          WHERE lang=? AND field_id=(SELECT id FROM fields WHERE section='catalog' AND path=?)`,
            )
            .get(lang, field) as { value: string }
        set.run('Custom catalogue title', 'nl', 'title')
        seedDatabase(previous, path.resolve('public/assets'))
        const original = get('heroImage').value
        assert.deepEqual(previous.prepare('SELECT filename FROM media WHERE id=?').get(original), {
          filename: 'products-sunny-table-v3.webp',
        })
        for (const lang of ['nl', 'en', 'fr', 'de']) {
          assert.equal(get('heroImage', lang).value, original)
          assert.ok(get('heroImageAlt', lang).value)
        }
        const custom = addMedia(
          previous,
          Buffer.from('custom-test-media'),
          'custom.webp',
          'image/webp',
        )
        set.run(String(custom), 'en', 'heroImage')
        set.run('', 'de', 'heroImage')
        set.run('Custom description', 'fr', 'heroImageAlt')
        previous.prepare("DELETE FROM settings WHERE key='seed-v10-products-hero'").run()
        seedDatabase(previous, path.resolve('public/assets'))
        seedDatabase(previous, path.resolve('public/assets'))
        assert.equal(get('title').value, 'Custom catalogue title')
        assert.equal(get('heroImage', 'en').value, String(custom))
        assert.equal(get('heroImage', 'de').value, '')
        assert.equal(get('heroImageAlt', 'fr').value, 'Custom description')
      } finally {
        previous.close()
        rmSync(heroDir, { recursive: true, force: true })
      }
    })
    await t.test('revised product geometry replaces only the original hero selection', () => {
      const dir = mkdtempSync(path.join(tmpdir(), 'zembro-products-geometry-'))
      const previous = openDatabase(dir)
      try {
        seedDatabase(previous, path.resolve('public/assets'))
        const original = addMedia(
          previous,
          readFileSync('public/assets/products-sunny-table.webp'),
          'products-sunny-table.webp',
          'image/webp',
        )
        const custom = addMedia(
          previous,
          Buffer.from('custom-product-hero'),
          'custom-hero.webp',
          'image/webp',
        )
        const set = previous.prepare(`UPDATE field_values SET value=? WHERE lang=? AND field_id=(
          SELECT id FROM fields WHERE section='catalog' AND path='heroImage')`)
        const get = (lang: string) =>
          (
            previous
              .prepare(
                `SELECT value FROM field_values WHERE lang=? AND field_id=(
          SELECT id FROM fields WHERE section='catalog' AND path='heroImage')`,
              )
              .get(lang) as { value: string }
          ).value
        set.run(String(original), 'nl')
        set.run(String(original), 'en')
        set.run(String(custom), 'fr')
        set.run('', 'de')
        previous.prepare("DELETE FROM settings WHERE key='seed-v12-products-geometry'").run()
        seedDatabase(previous, path.resolve('public/assets'))
        const revised = get('nl')
        assert.notEqual(revised, String(original))
        assert.deepEqual(previous.prepare('SELECT filename FROM media WHERE id=?').get(revised), {
          filename: 'products-sunny-table-v2.webp',
        })
        assert.equal(get('en'), revised)
        assert.equal(get('fr'), String(custom))
        assert.equal(get('de'), '')
        assert.ok(previous.prepare('SELECT id FROM media WHERE id=?').get(original))
        set.run(String(custom), 'en')
        seedDatabase(previous, path.resolve('public/assets'))
        assert.equal(get('en'), String(custom))
      } finally {
        previous.close()
        rmSync(dir, { recursive: true, force: true })
      }
    })
    await t.test(
      'Mini and dark hero migration preserves custom media and translated descriptions',
      () => {
        const dir = mkdtempSync(path.join(tmpdir(), 'zembro-mini-dark-'))
        const previous = openDatabase(dir)
        try {
          seedDatabase(previous, path.resolve('public/assets'))
          const original = addMedia(
            previous,
            readFileSync('public/assets/products-sunny-table-v2.webp'),
            'products-sunny-table-v2.webp',
            'image/webp',
          )
          const custom = addMedia(
            previous,
            Buffer.from('custom-dark-hero'),
            'custom-dark.webp',
            'image/webp',
          )
          const set = previous.prepare(`UPDATE field_values SET value=? WHERE lang=? AND field_id=(
          SELECT id FROM fields WHERE section='catalog' AND path=?)`)
          const get = (field: string, lang = 'nl') =>
            (
              previous
                .prepare(
                  `SELECT value FROM field_values WHERE lang=? AND field_id=(
          SELECT id FROM fields WHERE section='catalog' AND path=?)`,
                )
                .get(lang, field) as { value: string }
            ).value
          for (const lang of ['nl', 'en']) set.run(String(original), lang, 'heroImage')
          set.run(String(custom), 'fr', 'heroImage')
          set.run('', 'de', 'heroImage')
          set.run('Edited light alt', 'en', 'heroImageAlt')
          previous.exec(`DELETE FROM field_values WHERE field_id IN (SELECT id FROM fields WHERE section='catalog' AND path IN ('heroImageDark','heroImageDarkAlt'));
          DELETE FROM fields WHERE section='catalog' AND path IN ('heroImageDark','heroImageDarkAlt');
          DELETE FROM settings WHERE key='seed-v13-mini-dark';`)
          seedDatabase(previous, path.resolve('public/assets'))
          assert.deepEqual(
            previous.prepare('SELECT filename FROM media WHERE id=?').get(get('heroImage')),
            { filename: 'products-sunny-table-v3.webp' },
          )
          assert.equal(get('heroImage', 'en'), get('heroImage'))
          assert.equal(get('heroImage', 'fr'), String(custom))
          assert.equal(get('heroImage', 'de'), '')
          assert.equal(get('heroImageAlt', 'en'), 'Edited light alt')
          for (const lang of ['nl', 'en', 'fr', 'de']) {
            assert.deepEqual(
              previous
                .prepare('SELECT filename FROM media WHERE id=?')
                .get(get('heroImageDark', lang)),
              { filename: 'products-sunny-table-v3-dark.webp' },
            )
            assert.ok(get('heroImageDarkAlt', lang))
          }
          const count = previous.prepare('SELECT count(*) AS n FROM media').get()
          set.run(String(custom), 'fr', 'heroImageDark')
          set.run('', 'de', 'heroImageDark')
          set.run('Edited dark alt', 'en', 'heroImageDarkAlt')
          previous.prepare("DELETE FROM settings WHERE key='seed-v13-mini-dark'").run()
          seedDatabase(previous, path.resolve('public/assets'))
          seedDatabase(previous, path.resolve('public/assets'))
          assert.equal(get('heroImageDark', 'fr'), String(custom))
          assert.equal(get('heroImageDark', 'de'), '')
          assert.equal(get('heroImageDarkAlt', 'en'), 'Edited dark alt')
          assert.deepEqual(previous.prepare('SELECT count(*) AS n FROM media').get(), count)
        } finally {
          previous.close()
          rmSync(dir, { recursive: true, force: true })
        }
      },
    )
    await t.test(
      'legal migration adds content once and preserves existing edits and custom links',
      () => {
        const dir = mkdtempSync(path.join(tmpdir(), 'zembro-legal-'))
        const previous = openDatabase(dir)
        try {
          seedDatabase(previous, path.resolve('public/assets'))
          previous.exec(`DELETE FROM field_values WHERE field_id IN (SELECT id FROM fields WHERE section IN ('legalPrivacy','legalTerms'));
          DELETE FROM fields WHERE section IN ('legalPrivacy','legalTerms');
          DELETE FROM sections WHERE key IN ('legalPrivacy','legalTerms');
          DELETE FROM settings WHERE key='seed-v9-legal';`)
          const set = previous.prepare(
            `UPDATE field_values SET value=? WHERE lang=? AND field_id=(SELECT id FROM fields WHERE section=? AND path=?)`,
          )
          set.run('https://zembro.com/nl/policies/privacy-policy', 'nl', 'footer', 'privacyLink')
          set.run('https://example.com/custom-legal', 'fr', 'footer', 'privacyLink')
          seedDatabase(previous, path.resolve('public/assets'))
          const get = (section: string, field: string, lang: string) =>
            previous
              .prepare(
                `SELECT value FROM field_values WHERE lang=? AND field_id=(SELECT id FROM fields WHERE section=? AND path=?)`,
              )
              .get(lang, section, field)
          assert.deepEqual(get('footer', 'privacyLink', 'nl'), { value: '/privacy' })
          assert.deepEqual(get('footer', 'privacyLink', 'fr'), {
            value: 'https://example.com/custom-legal',
          })
          set.run('Edited legal copy', 'en', 'legalPrivacy', 'body1')
          set.run('', 'de', 'legalPrivacy', 'notice')
          previous.prepare("DELETE FROM settings WHERE key='seed-v9-legal'").run()
          seedDatabase(previous, path.resolve('public/assets'))
          assert.deepEqual(get('legalPrivacy', 'body1', 'en'), { value: 'Edited legal copy' })
          assert.deepEqual(get('legalPrivacy', 'notice', 'de'), { value: '' })
          assert.equal(
            (
              previous
                .prepare(
                  "SELECT COUNT(*) AS count FROM sections WHERE key IN ('legalPrivacy','legalTerms')",
                )
                .get() as { count: number }
            ).count,
            2,
          )
        } finally {
          previous.close()
          rmSync(dir, { recursive: true, force: true })
        }
      },
    )
    await t.test('logout invalidates the session', async () => {
      assert.equal((await request('/auth/logout', 'POST')).status, 200)
      assert.equal((await (await request('/auth/session')).json()).authenticated, false)
    })
    await t.test('failed login attempts are throttled', async () => {
      for (let i = 0; i < 8; i++)
        assert.equal((await request('/auth/login', 'POST', { password: 'wrong' })).status, 401)
      assert.equal((await request('/auth/login', 'POST', { password })).status, 429)
    })
    await t.test('session expiry and subpath media URLs', async () => {
      // Reopen a separate handle because the previous test intentionally restarted the database.
      const scoped = createApp({ db, password, origin, basePath: '/zembro/', sessionMs: 1 }).listen(
        0,
        '127.0.0.1',
      )
      await once(scoped, 'listening')
      try {
        const addr = scoped.address()
        assert.ok(addr && typeof addr === 'object')
        const root = `http://127.0.0.1:${addr.port}/zembro/api`
        const login = await fetch(root + '/auth/login', {
          method: 'POST',
          headers: { origin, 'content-type': 'application/json' },
          body: JSON.stringify({ password }),
        })
        const scopedCookie = login.headers.get('set-cookie')?.split(';')[0]
        assert.ok(scopedCookie)
        await new Promise((resolve) => setTimeout(resolve, 10))
        assert.equal(
          (
            await (
              await fetch(root + '/auth/session', { headers: { cookie: scopedCookie } })
            ).json()
          ).authenticated,
          false,
        )
        const data = (await (await fetch(root + '/sites/zembro/content')).json()) as Content
        assert.ok(data.sections.hero.image.startsWith('/zembro/api/media/'))
      } finally {
        await close(scoped)
      }
    })
  } finally {
    await close(server)
    db.close()
    assert.ok(path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep + 'zembro-tests-'))
    rmSync(dir, { recursive: true, force: true })
  }
})
function close(server: Server) {
  return new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
}
