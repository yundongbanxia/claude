#!/usr/bin/env python3
"""从 Google Fonts 取回只含本片用到的字形的字体子集（SIL OFL 许可），合并为单个 woff2 放进 fonts/。
需要：pip install fonttools brotli。仅在需要重新生成字体时运行。"""
import re, sys, glob, subprocess, urllib.parse, os, tempfile
from fontTools.ttLib import TTFont
from fontTools import merge as ftmerge

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

def curl(url, out=None):
    cmd = ['curl', '-sS', '-m', '90', '-A', UA, url] + (['-o', out] if out else [])
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode: raise RuntimeError(r.stderr.decode())
    return r.stdout.decode('utf-8', 'ignore')

# 收集“会被显示出来”的中日韩字符：JS 里的字符串字面量 + HTML 正文（忽略注释与样式）
CJK_RE = r'[\u2e80-\u9fff\u3000-\u303f\uff00-\uffef\u2010-\u206f\u00b7\u00d7\u2192\u2014\u25b6\u21ba\u00b0\u2212\u2022]'
txt = ''
for f in glob.glob(os.path.join(ROOT, 'js', '*.js')):
    src = open(f, encoding='utf-8').read()
    src = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
    src = re.sub(r'(?m)^\s*//.*$', '', src)
    for m in re.finditer(r"'(?:[^'\\\n]|\\.)*'|\"(?:[^\"\\\n]|\\.)*\"|`(?:[^`\\]|\\.)*`", src):
        txt += m.group(0)
html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
html = re.sub(r'<style.*?</style>|<script.*?</script>', '', html, flags=re.S)
txt += re.sub(r'<[^>]+>', '', html)
cjk = ''.join(sorted(set(re.findall(CJK_RE, txt))))
print('需要的 CJK 字形：', len(cjk))
latin = ''.join(chr(c) for c in range(32, 127)) + '·×—–’“”°→−'

def parse_ranges(s):
    out = []
    for part in s.split(','):
        part = part.strip().replace('U+', '')
        if '-' in part: a, b = part.split('-'); out.append((int(a, 16), int(b, 16)))
        elif part: out.append((int(part, 16), int(part, 16)))
    return out

def build(name, family, weight, text):
    url = f'https://fonts.googleapis.com/css2?family={family}:wght@{weight}&text=' + urllib.parse.quote(text)
    css = curl(url)
    blocks = re.findall(r'@font-face\s*\{(.*?)\}', css, re.S)
    need = {ord(c) for c in text}
    files = []
    tmp = tempfile.mkdtemp()
    for b in blocks:
        u = re.search(r'url\((https://[^)]+)\)', b); r = re.search(r'unicode-range:\s*([^;]+);', b)
        if not u: continue
        rng = parse_ranges(r.group(1)) if r else [(0, 0x10ffff)]
        if not any(a <= c <= z for c in need for a, z in rng): continue
        fp = os.path.join(tmp, f'{len(files)}.woff2'); curl(u.group(1), fp); files.append(fp)
    print(f'{name}: {len(files)} 个切片')
    fonts = []
    for i, f in enumerate(files):
        t = TTFont(f); t.flavor = None; p = os.path.join(tmp, f'{i}.ttf'); t.save(p); fonts.append(p)
    if len(fonts) == 1: m = TTFont(fonts[0])
    else: m = ftmerge.Merger().merge(fonts)
    m.flavor = 'woff2'
    out = os.path.join(ROOT, 'fonts', f'{name}.woff2'); m.save(out)
    print(f'  → {out}  {os.path.getsize(out)/1024:.1f} KB')

os.makedirs(os.path.join(ROOT, 'fonts'), exist_ok=True)
build('serif-sc-400', 'Noto+Serif+SC', 400, cjk + latin)
build('serif-sc-600', 'Noto+Serif+SC', 600, cjk + latin)
build('sans-sc-400', 'Noto+Sans+SC', 400, cjk)
build('sans-latin-400', 'Montserrat', 400, latin)
build('sans-latin-500', 'Montserrat', 500, latin)
build('mono-latin-400', 'JetBrains+Mono', 400, latin)
build('mono-latin-700', 'JetBrains+Mono', 700, latin)
