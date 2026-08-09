#!/usr/bin/env python3
"""
Supabase Documentation Crawler
Fetches all pages from https://supabase.com/docs and saves as organized Markdown files.
Sitemap-driven: uses /docs/sitemap.xml as primary URL source.
"""

import requests
import json
import os
import re
import time
import warnings
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning
import html2text
from datetime import datetime
from collections import defaultdict

warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

BASE_URL = "https://supabase.com"
DOCS_URL = "https://supabase.com/docs"
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
DELAY = 0.4  # seconds between requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# URL-path → folder category mapping (longest match wins)
CATEGORY_MAP = [
    ("/docs/guides/getting-started", "getting-started"),
    ("/docs/guides/ai-tools",        "ai"),
    ("/docs/guides/ai",              "ai"),
    ("/docs/guides/database",        "database"),
    ("/docs/guides/auth",            "auth"),
    ("/docs/guides/storage",         "storage"),
    ("/docs/guides/realtime",        "realtime"),
    ("/docs/guides/functions",       "edge-functions"),
    ("/docs/guides/cron",            "cron"),
    ("/docs/guides/queues",          "queues"),
    ("/docs/guides/graphql",         "api"),
    ("/docs/guides/api",             "api"),
    ("/docs/guides/cli",             "cli"),
    ("/docs/guides/local-development","cli"),
    ("/docs/guides/platform",        "platform"),
    ("/docs/guides/self-hosting",    "platform"),
    ("/docs/guides/deployment",      "platform"),
    ("/docs/guides/security",        "platform"),
    ("/docs/guides/monitoring-and-debugging", "platform"),
    ("/docs/guides/integrations",    "integrations"),
    ("/docs/guides/resources",       "guides"),
    ("/docs/reference/javascript",   "reference/javascript"),
    ("/docs/reference/python",       "reference/python"),
    ("/docs/reference/swift",        "reference/swift"),
    ("/docs/reference/dart",         "reference/dart"),
    ("/docs/reference/kotlin",       "reference/kotlin"),
    ("/docs/reference/csharp",       "reference/csharp"),
    ("/docs/reference/cli",          "reference/cli"),
    ("/docs/reference/api",          "reference/api"),
    ("/docs/reference",              "reference"),
    ("/docs/guides",                 "guides"),
    ("/docs",                        "general"),
]

# Progress tracking
progress = {
    "total_urls":       0,
    "success":          0,
    "failed":           0,
    "skipped":          0,
    "failed_urls":      [],
    "processed_urls":   set(),
    "markdown_count":   0,
    "code_block_count": 0,
}

category_counters = defaultdict(int)
knowledge_base = []


# ── helpers ──────────────────────────────────────────────────────────────────

def get_category(url):
    path = urlparse(url).path
    for prefix, cat in CATEGORY_MAP:
        if path.startswith(prefix):
            return cat
    return "general"


def sanitize_filename(title):
    safe = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', title)
    safe = re.sub(r'\s+', '_', safe.strip())
    return safe[:80] or "untitled"


def get_next_num(cat):
    category_counters[cat] += 1
    return category_counters[cat]


def fetch(url, session, retries=3):
    for attempt in range(retries):
        try:
            r = session.get(url, headers=HEADERS, timeout=30)
            if r.status_code == 200:
                return r
            if r.status_code == 404:
                return None
            if r.status_code == 429:
                wait = 15 * (attempt + 1)
                print(f"  Rate-limited, waiting {wait}s …")
                time.sleep(wait)
            else:
                time.sleep(3)
        except Exception as e:
            if attempt == retries - 1:
                print(f"  Fetch error {url}: {e}")
            else:
                time.sleep(3)
    return None


def main_content(soup):
    """Extract primary content node, stripping chrome."""
    for sel in ["article", "main article", ".prose", "[data-testid='docs-content']", "main"]:
        node = soup.select_one(sel)
        if node:
            break
    else:
        node = soup.find("body")

    if node:
        for junk in node.select(
            "nav, footer, header, aside, script, style, "
            "[class*='sidebar'], [class*='nav-'], [class*='footer'], "
            "[class*='header'], [class*='cookie'], [class*='banner'], "
            "[class*='toc'], [role='navigation']"
        ):
            junk.decompose()
    return node


def to_markdown(node):
    h = html2text.HTML2Text()
    h.ignore_links = False
    h.ignore_images = False
    h.ignore_tables = False
    h.body_width = 0
    h.protect_links = True
    h.wrap_links = False
    h.mark_code = True
    h.unicode_snob = True
    try:
        md = h.handle(str(node))
        return re.sub(r'\n{4,}', '\n\n\n', md).strip()
    except Exception:
        return ""


def page_title(soup, url):
    h1 = soup.find("h1")
    if h1:
        return h1.get_text(strip=True)
    t = soup.find("title")
    if t:
        return re.sub(r'\s*\|\s*Supabase.*$', '', t.get_text(strip=True)).strip()
    return urlparse(url).path.rstrip('/').split('/')[-1].replace('-', ' ').title()


def page_desc(soup):
    m = soup.find("meta", attrs={"name": "description"})
    if m and m.get("content"):
        return m["content"]
    p = soup.find("p")
    if p:
        t = p.get_text(strip=True)
        return (t[:300] + "…") if len(t) > 300 else t
    return ""


def page_tags(url, title, cat):
    tags = set()
    tags.add(cat.split("/")[0])
    path = urlparse(url).path
    tags.update(p for p in path.split("/") if p and p not in ("docs", "guides", "reference"))
    for w in re.findall(r'\b[A-Za-z]{4,}\b', title):
        tags.add(w.lower())
    kws = ["sql","javascript","typescript","python","react","nextjs","vue","nuxt",
           "flutter","swift","kotlin","graphql","rest","rls","auth","storage",
           "realtime","functions","database","postgres","api","cli","sdk","ai",
           "vector","embedding","pgvector","cron","queue","edge"]
    lo = (url + title).lower()
    tags.update(k for k in kws if k in lo)
    return sorted(tags)[:15]


def page_toc(soup):
    lines = []
    for h in soup.find_all(["h2", "h3"])[:25]:
        text = h.get_text(strip=True)
        level = int(h.name[1])
        indent = "  " * (level - 2)
        aid = h.get("id", "")
        lines.append(f"{indent}- [{text}](#{aid})" if aid else f"{indent}- {text}")
    return "\n".join(lines) or "（目次なし）"


def page_date(soup):
    t = soup.find("time")
    if t:
        return t.get("datetime", t.get_text(strip=True))
    return datetime.now().strftime("%Y-%m-%d")


# ── sitemap ───────────────────────────────────────────────────────────────────

def get_sitemap_urls(session):
    urls = set()
    for sm in ["https://supabase.com/docs/sitemap.xml",
               "https://supabase.com/sitemap.xml"]:
        try:
            r = session.get(sm, headers=HEADERS, timeout=30)
            if r.status_code != 200:
                continue
            soup = BeautifulSoup(r.text, "html.parser")
            locs = soup.find_all("loc")
            for loc in locs:
                u = loc.get_text(strip=True)
                if "/docs" in u and "supabase.com" in u:
                    urls.add(u.split("?")[0].split("#")[0])
            print(f"Sitemap {sm}: {len(locs)} entries")
        except Exception as e:
            print(f"Sitemap error {sm}: {e}")
    return urls


def crawl_links(url, session, known):
    """Find new /docs links on a page."""
    r = fetch(url, session)
    if not r:
        return set()
    soup = BeautifulSoup(r.text, "html.parser")
    new = set()
    for a in soup.find_all("a", href=True):
        full = urljoin(BASE_URL, a["href"])
        p = urlparse(full)
        if (p.netloc == "supabase.com"
                and p.path.startswith("/docs")
                and not p.fragment
                and not p.path.endswith(('.pdf','.png','.jpg','.svg','.gif'))
                and full not in known):
            clean = f"{p.scheme}://{p.netloc}{p.path}"
            if clean not in known:
                new.add(clean)
    return new


# ── page processing ───────────────────────────────────────────────────────────

def process_page(url, session):
    r = fetch(url, session)
    if not r:
        progress["failed"] += 1
        progress["failed_urls"].append(url)
        return None

    soup = BeautifulSoup(r.text, "html.parser")
    title = page_title(soup, url)
    desc  = page_desc(soup)
    cat   = get_category(url)
    tags  = page_tags(url, title, cat)
    date  = page_date(soup)

    node = main_content(soup)
    if not node:
        progress["failed"] += 1
        progress["failed_urls"].append(url)
        return None

    toc = page_toc(node)
    code_cnt = len(node.find_all("pre"))
    progress["code_block_count"] += code_cnt

    body = to_markdown(node)

    num = get_next_num(cat)
    safe = sanitize_filename(title)

    front = f"""---
タイトル: {title}
URL: {url}
カテゴリ: {cat}
更新日: {date}
タグ: {', '.join(tags)}
---

# {title}

**URL:** {url}
**カテゴリ:** {cat}
**更新日:** {date}
**タグ:** {', '.join(tags)}

## 目次

{toc}

## 概要

{desc}

---

"""

    cat_dir = os.path.join(OUTPUT_DIR, "docs", cat)
    os.makedirs(cat_dir, exist_ok=True)
    fname = f"{num:03d}_{safe}.md"
    fpath = os.path.join(cat_dir, fname)

    try:
        with open(fpath, "w", encoding="utf-8") as f:
            f.write(front + body)
        progress["success"] += 1
        progress["markdown_count"] += 1

        knowledge_base.append({
            "category": cat,
            "title":    title,
            "url":      url,
            "summary":  desc,
            "tags":     tags,
            "file":     f"docs/{cat}/{fname}",
            "code_blocks": code_cnt,
        })
        return fpath
    except Exception as e:
        print(f"  Save error: {e}")
        progress["failed"] += 1
        return None


# ── output files ──────────────────────────────────────────────────────────────

def save_progress(all_urls):
    remaining = [u for u in all_urls if u not in progress["processed_urls"]]
    content = f"""# Supabase Documentation Collection Progress

**生成日時:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## 収集統計

| 項目 | 数値 |
|------|------|
| 収集URL総数 | {progress['total_urls']} |
| 成功件数 | {progress['success']} |
| 失敗件数 | {progress['failed']} |
| スキップ件数 | {progress['skipped']} |
| 総Markdownファイル数 | {progress['markdown_count']} |
| 総コードブロック数 | {progress['code_block_count']} |

## カテゴリ別ファイル数

{chr(10).join(f'- **{c}**: {n} ファイル' for c, n in sorted(category_counters.items()))}

## 失敗URL（先頭100件）

{chr(10).join(f'- {u}' for u in progress['failed_urls'][:100])}

## 未取得ページ（先頭100件）

{chr(10).join(f'- {u}' for u in remaining[:100])}

---
*自動生成*
"""
    with open(os.path.join(OUTPUT_DIR, "progress.md"), "w", encoding="utf-8") as f:
        f.write(content)


def save_knowledge_json():
    with open(os.path.join(OUTPUT_DIR, "knowledge.json"), "w", encoding="utf-8") as f:
        json.dump(knowledge_base, f, ensure_ascii=False, indent=2)


def save_docs_index():
    by_cat = defaultdict(list)
    for item in knowledge_base:
        by_cat[item["category"]].append(item)

    lines = [
        "# Supabase Documentation Index\n",
        f"**生成日時:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  ",
        f"**総ページ数:** {len(knowledge_base)}  ",
        f"**総カテゴリ数:** {len(by_cat)}  \n",
        "## カテゴリ一覧\n",
    ]
    for cat in sorted(by_cat):
        lines.append(f"- [{cat}](docs/{cat}/) — {len(by_cat[cat])} ページ")

    lines += ["\n## フォルダ構成\n", "```", "docs/"]
    for cat in sorted(by_cat):
        lines.append(f"  {cat}/")
        for item in by_cat[cat][:3]:
            lines.append(f"    {item['file'].split('/')[-1]}")
        if len(by_cat[cat]) > 3:
            lines.append(f"    … (+{len(by_cat[cat])-3} files)")
    lines.append("```\n")

    lines.append("## カテゴリ別ページ一覧\n")
    for cat in sorted(by_cat):
        lines.append(f"\n### {cat}\n")
        for item in by_cat[cat]:
            lines.append(f"- [{item['title']}]({item['file']}) — {item['url']}")

    all_tags = sorted({t for item in knowledge_base for t in item["tags"]})
    lines += ["\n## 検索用タグ一覧\n", ", ".join(all_tags), "\n\n## URL一覧\n"]
    for item in knowledge_base:
        lines.append(f"- {item['url']}")

    with open(os.path.join(OUTPUT_DIR, "docs_index.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    print("=" * 65)
    print("Supabase Documentation Crawler")
    print("=" * 65)
    print(f"Output: {OUTPUT_DIR}")
    print(f"Start:  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    os.makedirs(os.path.join(OUTPUT_DIR, "docs"), exist_ok=True)

    session = requests.Session()

    # ── Phase 1: Collect URLs ──────────────────────────────────────────
    print("\n── Phase 1: URL Discovery ──────────────────────────────────")
    all_urls = get_sitemap_urls(session)
    print(f"Sitemap total: {len(all_urls)} docs URLs")

    # Supplement with link crawl from key entry points
    seeds = [
        DOCS_URL,
        "https://supabase.com/docs/guides/getting-started",
        "https://supabase.com/docs/reference/javascript",
        "https://supabase.com/docs/reference/python",
        "https://supabase.com/docs/reference/api",
    ]
    for seed in seeds:
        new = crawl_links(seed, session, all_urls)
        all_urls.update(new)
        time.sleep(DELAY)

    # Normalize
    all_urls = {u.split("?")[0].split("#")[0] for u in all_urls}
    all_urls = {u for u in all_urls if urlparse(u).path.startswith("/docs")}
    progress["total_urls"] = len(all_urls)
    print(f"Total URLs after dedup: {len(all_urls)}")

    # ── Phase 2: Process pages ─────────────────────────────────────────
    print("\n── Phase 2: Fetching & Converting Pages ────────────────────")
    sorted_urls = sorted(all_urls)
    total = len(sorted_urls)

    for i, url in enumerate(sorted_urls):
        if url in progress["processed_urls"]:
            progress["skipped"] += 1
            continue

        progress["processed_urls"].add(url)
        cat = get_category(url)
        pct = (i + 1) / total * 100

        fp = process_page(url, session)
        status = f"OK → {os.path.basename(fp)}" if fp else "FAIL"
        print(f"[{i+1:4d}/{total}] {pct:5.1f}% ({cat}) {url[:65]}")
        print(f"       {status}")

        # Periodic saves
        if (i + 1) % 100 == 0:
            save_progress(all_urls)
            save_knowledge_json()
            print(f"\n  >>> checkpoint saved ({i+1}/{total}) <<<\n")

        time.sleep(DELAY)

    # ── Phase 3: Final outputs ─────────────────────────────────────────
    print("\n── Phase 3: Saving Outputs ─────────────────────────────────")
    save_knowledge_json()
    save_docs_index()
    save_progress(all_urls)

    print("\n" + "=" * 65)
    print("COMPLETE")
    print(f"  Success:     {progress['success']}")
    print(f"  Failed:      {progress['failed']}")
    print(f"  Skipped:     {progress['skipped']}")
    print(f"  Markdown:    {progress['markdown_count']} files")
    print(f"  Code blocks: {progress['code_block_count']}")
    print(f"  Finish:      {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 65)


if __name__ == "__main__":
    main()
