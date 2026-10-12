export type LegalBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'table'; headers: string[]; rows: string[][] }

const tableCells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, '|'))
export function parseLegalBody(body: string): LegalBlock[] {
  // Shopify sometimes places a heading's closing bold tag after a paragraph break.
  const lines = body
    // Empty Shopify bold separators must not pair with the next heading's opening tag.
    .replace(/^[ \t]*\*{4,}[ \t]*$/gm, '')
    .replace(/\*\*[ \t\n]*([^*\n]+?)[ \t\n]*\*\*/g, '**$1**')
    .split('\n')
  const blocks: LegalBlock[] = []
  for (let i = 0; i < lines.length;) {
    const line = lines[i].trim()
    // Empty bold elements in the published Shopify markup have no visible content.
    if (!line || /^\*+$/.test(line)) {
      i++
      continue
    }
    if (line.startsWith('## ') || /^\*\*[^*]+\*\*$/.test(line)) {
      blocks.push({
        kind: 'heading',
        text: line.startsWith('## ') ? line.slice(3) : line.slice(2, -2),
      })
      i++
      continue
    }
    if (line.startsWith('|') && /^\|[\s:|-]+\|$/.test(lines[i + 1]?.trim() ?? '')) {
      const headers = tableCells(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(tableCells(lines[i++]))
      blocks.push({ kind: 'table', headers, rows })
      continue
    }
    const list = /^(?:- |\d+\. )/.exec(line)
    if (list) {
      const ordered = list[0] !== '- '
      const pattern = ordered ? /^\d+\. / : /^- /
      const items: string[] = []
      while (i < lines.length && pattern.test(lines[i].trim()))
        items.push(lines[i++].trim().replace(pattern, ''))
      blocks.push({ kind: 'list', ordered, items })
      continue
    }
    const paragraph = [line]
    i++
    while (i < lines.length && lines[i].trim() && !/^(## |\||- |\d+\. )/.test(lines[i].trim()))
      paragraph.push(lines[i++].trim())
    blocks.push({ kind: 'paragraph', text: paragraph.join('\n') })
  }
  // The published privacy policy marks each postal-address line as a heading.
  // Keep its customer-service heading, but render the three address lines together.
  const contact = blocks.findIndex(
    (block) =>
      block.kind === 'heading' &&
      block.text.replace(/\*\*/g, '').trim() === 'Zembro Customer Service',
  )
  if (contact !== -1) {
    const address = blocks.slice(contact + 1, contact + 4)
    if (address.length === 3 && address.every((block) => block.kind === 'heading')) {
      blocks.splice(contact + 1, 3, {
        kind: 'paragraph',
        text: address.map((block) => (block.kind === 'heading' ? block.text : '')).join('\n'),
      })
    }
  }
  return blocks
}
export type LegalInline =
  { kind: 'text' | 'strong'; text: string } | { kind: 'link'; text: string; href: string }
export function parseLegalInline(text: string): LegalInline[] {
  const parts: LegalInline[] = []
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g
  let previous = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index > previous)
      parts.push({ kind: 'text', text: text.slice(previous, match.index) })
    if (match[3]) parts.push({ kind: 'strong', text: match[3] })
    else if (/^(https?:\/\/|mailto:|tel:|#[\w-]+$)/i.test(match[2]))
      parts.push({ kind: 'link', text: match[1], href: match[2] })
    else parts.push({ kind: 'text', text: match[1] })
    previous = match.index + match[0].length
  }
  if (previous < text.length) parts.push({ kind: 'text', text: text.slice(previous) })
  return parts
}
