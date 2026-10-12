"""Import published Zembro policy text without storefront markup or scripts."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
import hashlib
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]

class PolicyParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.parts = []
        self.lang = ''
        self.lists = []
        self.hrefs = []
        self.raw_parts = []
        self.table_rows = []
        self.table_parent = None
        self.row = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'html':
            self.lang = attrs.get('lang', '')
        if not self.depth:
            if 'shopify-policy__body' in attrs.get('class', '').split():
                self.depth = 1
            return
        if tag not in ('br', 'hr', 'img', 'input', 'meta', 'link'):
            self.depth += 1
        if tag == 'table':
            self.table_parent = self.parts
            self.parts = []
            self.table_rows = []
        elif tag == 'tr':
            self.row = []
        elif tag in ('td', 'th'):
            self.parts = []
        elif tag in ('p', 'div'):
            self.parts.append('\n\n')
        elif tag in ('h1', 'h2', 'h3', 'h4'):
            self.parts.append('\n\n## ')
        elif tag == 'br':
            self.parts.append('\n')
        elif tag in ('ul', 'ol'):
            self.lists.append(tag)
            self.parts.append('\n\n')
        elif tag == 'li':
            self.parts.append('\n' + ('1. ' if self.lists and self.lists[-1] == 'ol' else '- '))
        elif tag == 'a':
            href = attrs.get('href', '')
            if href.startswith('/'):
                href = 'https://zembro.com' + href
            self.hrefs.append(href)
            self.parts.append('[')
        elif tag in ('strong', 'b'):
            self.parts.append('**')

    def handle_endtag(self, tag):
        if not self.depth:
            return
        if tag in ('td', 'th'):
            self.row.append(re.sub(r'\s+', ' ', ''.join(self.parts)).strip().replace('|', '\\|'))
            self.parts = []
        elif tag == 'tr':
            if any(self.row):
                self.table_rows.append(self.row)
        elif tag == 'table':
            rows = self.table_rows
            self.parts = self.table_parent
            self.table_parent = None
            if rows:
                width = max(len(row) for row in rows)
                lines = ['| ' + ' | '.join(row + ['']*(width-len(row))) + ' |' for row in rows]
                lines.insert(1, '| ' + ' | '.join(['---']*width) + ' |')
                self.parts.append('\n\n'+'\n'.join(lines)+'\n\n')
        elif tag == 'a':
            href = self.hrefs.pop() if self.hrefs else ''
            self.parts.append('](' + href + ')')
        elif tag in ('strong', 'b'):
            self.parts.append('**')
        elif tag in ('p', 'div', 'h1', 'h2', 'h3', 'h4'):
            self.parts.append('\n\n')
        elif tag in ('ul', 'ol') and self.lists:
            self.lists.pop()
            self.parts.append('\n\n')
        if tag not in ('br', 'hr', 'img', 'input', 'meta', 'link'):
            self.depth -= 1

    def handle_data(self, data):
        if self.depth:
            self.parts.append(re.sub(r'\s+', ' ', data.replace('\xa0', ' ')))
            self.raw_parts.append(data)

    def body(self):
        text = ''.join(self.parts)
        text = re.sub(r' *\n *', '\n', text)
        text = re.sub(r'\n{3,}', '\n\n', text).strip()
        text = re.sub(r'(?m)^## *\n', '', text)
        # Shopify expresses many legal headings as bold paragraphs.
        text = re.sub(r'(?m)^\*\*([^\n*]+)\*\*$', r'## \1', text)
        return text

def load(item):
    lang, policy = item
    prefix = '' if lang == 'en' else lang + '/'
    url = f'https://zembro.com/{prefix}policies/{policy}'
    # Use the project's Node runtime and its current TLS trust store for retrieval.
    response = subprocess.run(['node', '--input-type=module', '-e',
        "const r=await fetch(process.argv[1],{signal:AbortSignal.timeout(40000)});"
        "if(!r.ok)throw new Error('HTTP '+r.status);"
        "console.log(JSON.stringify({url:r.url,html:await r.text()}));", url],
        check=True, capture_output=True, encoding='utf-8')
    downloaded = json.loads(response.stdout)
    final_url, html = downloaded['url'], downloaded['html']
    parser = PolicyParser()
    parser.feed(html)
    body = parser.body()
    if len(body) < 200 or parser.depth:
        raise RuntimeError(f'Incomplete policy extraction: {url}')
    if parser.lang.split('-')[0] != lang:
        raise RuntimeError(f'Unexpected source language {parser.lang}: {url}')
    # Verify every source word remains in order after formatting conversion.
    visible = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', body)
    visible = re.sub(r'(?m)^1\. ', '', visible)
    words = lambda value: re.findall(r'[^\W_]+', value, re.UNICODE)
    if words(visible) != words(' '.join(parser.raw_parts)):
        raise RuntimeError(f'Policy text changed during conversion: {url}')
    return lang, policy, {'url': final_url, 'language': parser.lang, 'body': body,
                          'sha256': hashlib.sha256(body.encode()).hexdigest()}

items = [(lang, policy) for lang in ('nl', 'en', 'fr')
         for policy in ('privacy-policy', 'terms-of-service')]
with ThreadPoolExecutor(max_workers=4) as executor:
    results = list(executor.map(load, items))
policies = {policy: {} for policy in ('privacy-policy', 'terms-of-service')}
for lang, policy, value in results:
    policies[policy][lang] = value
    print(f'{policy} {lang}: {len(value["body"])} characters, {value["language"]}, {value["url"]}')
snapshot = {'retrievedAt': datetime.now(timezone.utc).isoformat(), 'policies': policies}
(ROOT / 'artwork/legal').mkdir(parents=True, exist_ok=True)
(ROOT / 'artwork/legal/source-policies.json').write_text(json.dumps(snapshot, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
(ROOT / 'server/legal-source.ts').write_text('// Published source text; generated by scripts/import-legal.py.\nexport const legalSource = '+json.dumps(policies, ensure_ascii=False, indent=2)+' as const\n', encoding='utf-8')
