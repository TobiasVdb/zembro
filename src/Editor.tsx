import { useEffect, useState, useRef } from 'react'
import {
  ArrowUp,
  ArrowDown,
  X,
  PencilSimple,
  SignOut,
  FloppyDisk,
  UploadSimple,
  Images,
  Trash,
} from '@phosphor-icons/react'
import {
  LANGUAGES,
  type Field,
  type Lang,
  type Section,
  type MediaItem,
  type SectionKey,
} from '../shared/types'
import type { Selection } from './App'
import { api, base } from './api'
interface Props {
  lang: Lang
  authenticated: boolean
  onAuth: (value: boolean) => void
  editing: boolean
  onEditing: (value: boolean) => void
  selection: Selection | null
  onSelection: (value: Selection | null) => void
  onSaved: () => void
}
export default function Editor({
  lang,
  authenticated,
  onAuth,
  editing,
  onEditing,
  selection,
  onSelection,
  onSaved,
}: Props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [sections, setSections] = useState<Section[]>([])
  const [media, setMedia] = useState<MediaItem[]>([])
  const [panel, setPanel] = useState<'fields' | 'layout' | 'media'>('fields')
  const [editLang, setEditLang] = useState<Lang>(lang)
  const [draft, setDraft] = useState<Partial<Record<Lang, string>>>({})
  const [saved, setSaved] = useState<Partial<Record<Lang, string>>>({})
  const [current, setCurrent] = useState<Selection | null>(null)
  const draftRef = useRef(draft)
  draftRef.current = draft
  const savedRef = useRef(saved)
  savedRef.current = saved
  const currentRef = useRef(current)
  currentRef.current = current
  const dirty = LANGUAGES.some((l) => draft[l] !== saved[l])
  const selected: Field | undefined = sections
    .find((s) => s.key === current?.section)
    ?.fields.find((f) => f.path === current?.path)
  const load = async () => {
    const [data, items] = await Promise.all([
      api<{ sections: Section[] }>('/sites/zembro/editor'),
      api<MediaItem[]>('/media'),
    ])
    setSections(data.sections)
    setMedia(items)
    return data.sections
  }
  useEffect(() => {
    if (authenticated)
      load().catch((e) => setError(e instanceof Error ? e.message : 'Failed to load editor'))
  }, [authenticated])
  useEffect(() => {
    if (!selection) return
    if (busy) {
      onSelection(currentRef.current)
      return
    }
    if (
      currentRef.current?.section === selection.section &&
      currentRef.current?.path === selection.path
    )
      return
    if (
      LANGUAGES.some((l) => draftRef.current[l] !== savedRef.current[l]) &&
      !window.confirm('Discard unsaved changes to this field?')
    ) {
      onSelection(currentRef.current)
      return
    }
    const field = sections
      .find((s) => s.key === selection.section)
      ?.fields.find((f) => f.path === selection.path)
    if (!field) return
    setCurrent(selection)
    setDraft({ ...field.values })
    setSaved({ ...field.values })
    setEditLang(lang)
    setPanel('fields')
    setError('')
    setStatus('')
  }, [selection, sections, lang, onSelection, busy])
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  const discard = () => !dirty || window.confirm('Discard unsaved changes to this field?')
  const close = () => {
    if (!discard()) return
    onSelection(null)
    setCurrent(null)
    setDraft({})
    setSaved({})
    onEditing(false)
  }
  const handleError = (e: unknown) => {
    setError(e instanceof Error ? e.message : 'The request failed. Please try again.')
    setStatus('')
  }
  const login = async () => {
    setBusy(true)
    setError('')
    try {
      await api('/auth/login', { method: 'POST', body: JSON.stringify({ password }) })
      setPassword('')
      onAuth(true)
      onEditing(true)
    } catch (e) {
      handleError(e)
    } finally {
      setBusy(false)
    }
  }
  const logout = async () => {
    if (!discard()) return
    setBusy(true)
    try {
      await api('/auth/logout', { method: 'POST' })
      onAuth(false)
      onEditing(false)
      onSelection(null)
    } catch (e) {
      handleError(e)
    } finally {
      setBusy(false)
    }
  }
  const save = async () => {
    if (!current) return
    setBusy(true)
    setError('')
    setStatus('Saving…')
    let changed = false
    try {
      for (const language of LANGUAGES)
        if (draft[language] !== saved[language]) {
          await api(
            `/sites/zembro/sections/${current.section}/fields/${encodeURIComponent(current.path)}`,
            {
              method: 'PUT',
              body: JSON.stringify({ lang: language, value: draft[language] ?? '' }),
            },
          )
          changed = true
          setSaved((old) => ({ ...old, [language]: draft[language] ?? '' }))
        }
      await load()
      setStatus('Saved. Published content updated.')
    } catch (e) {
      handleError(e)
    } finally {
      if (changed) onSaved()
      setBusy(false)
    }
  }
  const move = async (key: SectionKey, direction: number) => {
    const ordered = sections.filter((s) => s.reorderable).sort((a, b) => a.position - b.position)
    const index = ordered.findIndex((s) => s.key === key)
    const to = index + direction
    if (to < 0 || to >= ordered.length) return
    ;[ordered[index], ordered[to]] = [ordered[to], ordered[index]]
    setBusy(true)
    setError('')
    try {
      await api('/sites/zembro/sections/reorder', {
        method: 'PUT',
        body: JSON.stringify({ order: ordered.map((s) => s.key) }),
      })
      await load()
      onSaved()
      setStatus('Section order saved.')
    } catch (e) {
      handleError(e)
    } finally {
      setBusy(false)
    }
  }
  const upload = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError('')
    setStatus('Uploading…')
    try {
      const body = new FormData()
      body.append('file', file)
      const item = await api<MediaItem>('/media', { method: 'POST', body })
      await load()
      if (
        selected &&
        (selected.type === 'image'
          ? item.mimeType.startsWith('image/')
          : selected.type === 'video' && item.mimeType === 'video/mp4')
      )
        setDraft((old) => ({ ...old, [editLang]: String(item.id) }))
      setStatus('Uploaded. Save the field to use this media.')
    } catch (e) {
      handleError(e)
    } finally {
      setBusy(false)
    }
  }
  const remove = async (item: MediaItem) => {
    if (!window.confirm(`Delete ${item.filename}?`)) return
    setBusy(true)
    setError('')
    try {
      await api(`/media/${item.id}`, { method: 'DELETE' })
      await load()
      setStatus('Media deleted.')
    } catch (e) {
      handleError(e)
    } finally {
      setBusy(false)
    }
  }
  if (!authenticated)
    return (
      <main className="admin-login">
        <a className="brand" href={`${base}/`}>
          <img src={`${base}/assets/logo.png`} className="logo" alt="Zembro" />
        </a>
        <form
          className="login-form"
          onSubmit={(e) => {
            e.preventDefault()
            void login()
          }}
        >
          <p className="eyebrow">CONTENT STUDIO</p>
          <h1>
            A little care
            <br />
            for your website.
          </h1>
          <p>Sign in to edit Zembro’s content, translations and imagery.</p>
          <label>
            Editor password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={busy}
            />
          </label>
          {error && (
            <p className="editor-error" role="alert">
              {error}
            </p>
          )}
          <button className="button" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <a className="text-link" href={`${base}/`}>
            Back to the website
          </a>
        </form>
      </main>
    )
  return (
    <>
      <div className="edit-toolbar">
        <a href={`${base}/admin`} className="studio-name">
          Zembro <span>Content studio</span>
        </a>
        <button
          className={editing ? 'active' : ''}
          onClick={() => (editing ? close() : onEditing(true))}
        >
          <PencilSimple size={18} />
          {editing ? 'Finish editing' : 'Edit page'}
        </button>
        <button
          onClick={() => {
            setPanel('layout')
            onEditing(true)
          }}
        >
          Section order
        </button>
        <button
          onClick={() => {
            setPanel('media')
            onEditing(true)
          }}
        >
          <Images size={18} />
          Media
        </button>
        <button onClick={() => void logout()} disabled={busy}>
          <SignOut size={18} />
          Sign out
        </button>
      </div>
      {editing && (
        <aside className="editor-panel" aria-label="Content editor">
          <div className="editor-heading">
            <div>
              <p className="eyebrow">CONTENT STUDIO</p>
              <h2>
                {panel === 'layout'
                  ? 'Section order'
                  : panel === 'media'
                    ? 'Media library'
                    : 'Edit content'}
              </h2>
            </div>
            <button className="icon-button" onClick={close} aria-label="Close editor">
              <X size={22} />
            </button>
          </div>
          <div className="editor-tabs">
            {(['fields', 'layout', 'media'] as const).map((tab) => (
              <button key={tab} onClick={() => setPanel(tab)} aria-pressed={panel === tab}>
                {tab === 'fields' ? 'Content' : tab === 'layout' ? 'Layout' : 'Media'}
              </button>
            ))}
          </div>
          {error && (
            <p className="editor-error" role="alert">
              {error}
            </p>
          )}
          {status && (
            <p className="editor-status" role="status">
              {status}
            </p>
          )}
          {panel === 'fields' && (
            <>
              <p className="editor-help">
                Click text or imagery on the page, or select a field below. Changes go live when
                saved.
              </p>
              <label>
                Field
                <select
                  value={current ? `${current.section}/${current.path}` : ''}
                  disabled={busy}
                  onChange={(e) => {
                    const [section, path] = e.target.value.split('/')
                    if (section && path) onSelection({ section: section as SectionKey, path })
                  }}
                >
                  <option value="">Choose content…</option>
                  {sections.map((s) => (
                    <optgroup key={s.key} label={s.key}>
                      {s.fields.map((f) => (
                        <option key={f.path} value={`${s.key}/${f.path}`}>
                          {f.path} · {f.type}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              {selected && (
                <>
                  <div className="translation-tabs">
                    {LANGUAGES.map((l) => (
                      <button key={l} onClick={() => setEditLang(l)} aria-pressed={editLang === l}>
                        {l.toUpperCase()}
                        {draft[l] !== saved[l] ? ' •' : ''}
                      </button>
                    ))}
                  </div>
                  <label>
                    {selected.type === 'link'
                      ? 'Destination'
                      : selected.type === 'text'
                        ? 'Translation'
                        : 'Media'}{' '}
                    · {editLang.toUpperCase()}
                    {selected.type === 'text' ? (
                      <textarea
                        value={draft[editLang] ?? ''}
                        onChange={(e) =>
                          setDraft((old) => ({ ...old, [editLang]: e.target.value }))
                        }
                        rows={7}
                        disabled={busy}
                      />
                    ) : selected.type === 'link' ? (
                      <input
                        value={draft[editLang] ?? ''}
                        onChange={(e) =>
                          setDraft((old) => ({ ...old, [editLang]: e.target.value }))
                        }
                        disabled={busy}
                      />
                    ) : (
                      <select
                        value={draft[editLang] ?? ''}
                        onChange={(e) =>
                          setDraft((old) => ({ ...old, [editLang]: e.target.value }))
                        }
                        disabled={busy}
                      >
                        <option value="">No media</option>
                        {media
                          .filter((m) =>
                            selected.type === 'image'
                              ? m.mimeType.startsWith('image/')
                              : m.mimeType === 'video/mp4',
                          )
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.filename}
                            </option>
                          ))}
                      </select>
                    )}
                  </label>
                  {(selected.type === 'image' || selected.type === 'video') && (
                    <>
                      <div className="media-preview">
                        {draft[editLang] &&
                          (selected.type === 'image' ? (
                            <img
                              src={`${base}/api/media/${draft[editLang]}`}
                              alt="Selected media preview"
                            />
                          ) : (
                            <video
                              src={`${base}/api/media/${draft[editLang]}`}
                              controls
                              preload="metadata"
                            />
                          ))}
                      </div>
                      <label className="upload-button">
                        <UploadSimple size={19} />
                        Upload replacement
                        <input
                          type="file"
                          accept={
                            selected.type === 'image'
                              ? 'image/png,image/jpeg,image/webp'
                              : 'video/mp4'
                          }
                          disabled={busy}
                          onChange={(e) => {
                            void upload(e.target.files?.[0])
                            e.target.value = ''
                          }}
                        />
                      </label>
                    </>
                  )}
                  <p className="editor-help">
                    Each language is saved separately. Empty text stays empty; a missing translation
                    falls back to Dutch.
                  </p>
                  <button
                    className="button save-button"
                    onClick={() => void save()}
                    disabled={busy || !dirty}
                  >
                    <FloppyDisk size={18} />
                    {busy ? 'Saving…' : 'Save changes'}
                  </button>
                </>
              )}
            </>
          )}
          {panel === 'layout' && (
            <>
              <p className="editor-help">
                Move the middle sections. The header, hero and footer stay fixed. Each move is saved
                immediately.
              </p>
              <ol className="order-list">
                {sections
                  .filter((s) => s.reorderable)
                  .sort((a, b) => a.position - b.position)
                  .map((s, i, array) => (
                    <li key={s.key}>
                      <span>{s.key}</span>
                      <button
                        aria-label={`Move ${s.key} up`}
                        disabled={busy || i === 0}
                        onClick={() => void move(s.key, -1)}
                      >
                        <ArrowUp size={19} />
                      </button>
                      <button
                        aria-label={`Move ${s.key} down`}
                        disabled={busy || i === array.length - 1}
                        onClick={() => void move(s.key, 1)}
                      >
                        <ArrowDown size={19} />
                      </button>
                    </li>
                  ))}
              </ol>
            </>
          )}
          {panel === 'media' && (
            <>
              <label className="upload-button">
                <UploadSimple size={19} />
                Upload media
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,video/mp4"
                  disabled={busy}
                  onChange={(e) => {
                    void upload(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </label>
              <p className="editor-help">
                PNG, JPEG, WebP or MP4. Maximum 60 MB. Media used by the site cannot be deleted.
              </p>
              <div className="media-library">
                {media.map((item) => (
                  <div className="media-item" key={item.id}>
                    {item.mimeType.startsWith('image/') ? (
                      <img src={item.url} alt={item.filename} loading="lazy" />
                    ) : (
                      <video src={item.url} controls preload="none" />
                    )}
                    <span>{item.filename}</span>
                    <button
                      aria-label={`Delete ${item.filename}`}
                      disabled={busy}
                      onClick={() => void remove(item)}
                    >
                      <Trash size={17} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>
      )}
    </>
  )
}
