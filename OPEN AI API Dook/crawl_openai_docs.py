#!/usr/bin/env python3
"""OpenAI Developers API Docs Crawler
Crawls https://developers.openai.com/api/docs and saves pages as Markdown.
"""

import os
import re
import time
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List, Dict

import requests
from bs4 import BeautifulSoup
import markdownify

BASE_URL = "https://developers.openai.com"
START_PATH = "/api/docs"
SAVE_ROOT = Path("/Users/tanakayoshiki/Desktop/OPEN AI APIリスト/OPENAI_DOCS")
ASSETS_DIR = SAVE_ROOT / "assets"
CRAWLED: set[str] = set()

# All /api/docs paths discovered from the navigation
ALL_PATHS = [
    "/api/docs",
    "/api/docs/quickstart",
    "/api/docs/guides/latest-model",
    "/api/docs/concepts",
    "/api/docs/guides/migrate-to-responses",
    "/api/docs/guides/conversation-state",
    "/api/docs/guides/background",
    "/api/docs/guides/streaming-responses",
    "/api/docs/guides/websocket-mode",
    "/api/docs/guides/responses-multi-agent",
    "/api/docs/guides/webhooks",
    "/api/docs/guides/file-inputs",
    "/api/docs/guides/compaction",
    "/api/docs/guides/token-counting",
    "/api/docs/libraries",
    "/api/docs/libraries/openai-cli",
    "/api/docs/changelog",
    "/api/docs/deprecations",
    "/api/docs/supported-countries",
    "/api/docs/bots",
    "/api/docs/guides/agent-builder",
    "/api/docs/guides/agent-builder/migrate-from-agent-builder",
    "/api/docs/guides/node-reference",
    "/api/docs/guides/agent-builder-safety",
    "/api/docs/guides/evaluation-getting-started",
    "/api/docs/guides/evals",
    "/api/docs/guides/prompt-optimizer",
    "/api/docs/guides/external-models",
    "/api/docs/guides/evaluation-best-practices",
    "/api/docs/guides/graders",
    "/api/docs/guides/model-optimization",
    "/api/docs/guides/supervised-fine-tuning",
    "/api/docs/guides/vision-fine-tuning",
    "/api/docs/guides/direct-preference-optimization",
    "/api/docs/guides/reinforcement-fine-tuning",
    "/api/docs/guides/rft-use-cases",
    "/api/docs/guides/fine-tuning-best-practices",
    "/api/docs/assistants/migration",
    "/api/docs/assistants/deep-dive",
    "/api/docs/assistants/tools",
    "/api/docs/pricing",
    "/api/docs/guides/model-selection",
    "/api/docs/guides/text",
    "/api/docs/guides/code-generation",
    "/api/docs/guides/structured-outputs",
    "/api/docs/guides/prompting",
    "/api/docs/guides/prompt-engineering",
    "/api/docs/guides/citation-formatting",
    "/api/docs/guides/prompting/migrate-from-prompt-object",
    "/api/docs/guides/prompt-generation",
    "/api/docs/guides/frontend-prompt",
    "/api/docs/guides/reasoning",
    "/api/docs/guides/reasoning-best-practices",
    "/api/docs/guides/images-vision",
    "/api/docs/guides/image-generation",
    "/api/docs/guides/video-generation",
    "/api/docs/guides/audio",
    "/api/docs/guides/realtime",
    "/api/docs/guides/voice-agents",
    "/api/docs/guides/deep-research",
    "/api/docs/guides/embeddings",
    "/api/docs/guides/moderation",
    "/api/docs/guides/agents",
    "/api/docs/guides/agents/quickstart",
    "/api/docs/guides/agents/define-agents",
    "/api/docs/guides/agents/models",
    "/api/docs/guides/agents/running-agents",
    "/api/docs/guides/agents/sandboxes",
    "/api/docs/guides/agents/orchestration",
    "/api/docs/guides/agents/guardrails-approvals",
    "/api/docs/guides/agents/results",
    "/api/docs/guides/agents/integrations-observability",
    "/api/docs/guides/agent-evals",
    "/api/docs/guides/chatkit",
    "/api/docs/guides/chatkit-themes",
    "/api/docs/guides/chatkit-widgets",
    "/api/docs/guides/chatkit-actions",
    "/api/docs/guides/custom-chatkit",
    "/api/docs/guides/tools",
    "/api/docs/guides/function-calling",
    "/api/docs/guides/tools-web-search",
    "/api/docs/guides/tools-file-search",
    "/api/docs/guides/retrieval",
    "/api/docs/guides/tools-connectors-mcp",
    "/api/docs/guides/secure-mcp-tunnels",
    "/api/docs/guides/tools-skills",
    "/api/docs/guides/tools-tool-search",
    "/api/docs/guides/tools-programmatic-tool-calling",
    "/api/docs/guides/tools-shell",
    "/api/docs/guides/tools-computer-use",
    "/api/docs/guides/tools-apply-patch",
    "/api/docs/guides/tools-local-shell",
    "/api/docs/guides/tools-code-interpreter",
    "/api/docs/guides/tools-image-generation",
    "/api/docs/guides/realtime-translation",
    "/api/docs/guides/realtime-models-prompting",
    "/api/docs/guides/realtime-transcription",
    "/api/docs/guides/speech-to-text",
    "/api/docs/guides/text-to-speech",
    "/api/docs/guides/realtime-webrtc",
    "/api/docs/guides/realtime-websocket",
    "/api/docs/guides/realtime-sip",
    "/api/docs/guides/realtime-conversations",
    "/api/docs/guides/realtime-vad",
    "/api/docs/guides/realtime-mcp",
    "/api/docs/guides/realtime-server-controls",
    "/api/docs/guides/realtime-costs",
    "/api/docs/guides/production-best-practices",
    "/api/docs/guides/deployment-checklist",
    "/api/docs/guides/latency-optimization",
    "/api/docs/guides/predicted-outputs",
    "/api/docs/guides/priority-processing",
    "/api/docs/guides/optimizing-llm-accuracy",
    "/api/docs/guides/cost-optimization",
    "/api/docs/guides/prompt-caching",
    "/api/docs/guides/batch",
    "/api/docs/guides/flex-processing",
    "/api/docs/guides/safety-best-practices",
    "/api/docs/guides/red-teaming",
    "/api/docs/guides/safety-checks",
    "/api/docs/guides/safety-checks/cybersecurity",
    "/api/docs/guides/safety-checks/under-18-api-guidance",
    "/api/docs/guides/your-data",
    "/api/docs/guides/rbac",
    "/api/docs/guides/private-link",
    "/api/docs/guides/workload-identity-federation",
    "/api/docs/guides/workload-identity-federation/kubernetes",
    "/api/docs/guides/workload-identity-federation/aws",
    "/api/docs/guides/workload-identity-federation/microsoft-azure",
    "/api/docs/guides/workload-identity-federation/google-cloud",
    "/api/docs/guides/workload-identity-federation/github-actions",
    "/api/docs/guides/workload-identity-federation/spiffe",
    "/api/docs/guides/ip-addresses",
    "/api/docs/guides/amazon-bedrock",
    "/api/docs/guides/rate-limits",
    "/api/docs/guides/spend-limits",
    "/api/docs/guides/admin-apis",
    "/api/docs/guides/error-codes",
    "/api/docs/models",
    "/api/reference/overview",
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

session = requests.Session()
session.headers.update(HEADERS)

# Tracks: path -> (title, local_file_path, fetched_at)
PAGE_INDEX: list[dict] = []


def path_to_local(url_path: str) -> Path:
    """Convert a URL path like /api/docs/guides/text to a local file path."""
    clean = url_path.lstrip("/")
    # /api/docs -> api/docs/index.md
    # /api/docs/quickstart -> api/docs/quickstart.md
    parts = clean.split("/")
    if not parts[-1] or parts[-1] == "docs":
        parts.append("index")
    local = SAVE_ROOT / Path(*parts)
    return local.with_suffix(".md")


def local_rel_link(from_path: Path, to_url_path: str) -> str:
    """Return a relative markdown link from from_path to the target url_path."""
    to_local = path_to_local(to_url_path)
    try:
        return os.path.relpath(to_local, from_path.parent)
    except ValueError:
        return str(to_local)


def download_image(img_url: str) -> str:
    """Download an image and return its local relative path from SAVE_ROOT."""
    try:
        parsed = urllib.parse.urlparse(img_url)
        img_name = Path(parsed.path).name
        if not img_name:
            img_name = "image.png"
        # Avoid collisions by prepending a path hash
        safe_name = re.sub(r"[^\w.\-]", "_", parsed.path.lstrip("/")).replace("/", "_")
        local_img = ASSETS_DIR / safe_name
        if not local_img.exists():
            r = session.get(img_url, timeout=15)
            if r.status_code == 200:
                local_img.write_bytes(r.content)
        return str(os.path.relpath(local_img, SAVE_ROOT))
    except Exception as e:
        print(f"    [img error] {img_url}: {e}")
        return img_url


def extract_main_content(soup: BeautifulSoup, url: str) -> tuple[str, str]:
    """Extract title and main content from soup."""
    # Try to find the page title
    title = ""
    h1 = soup.find("h1")
    if h1:
        title = h1.get_text(strip=True)
    elif soup.title:
        title = soup.title.get_text(strip=True)

    # Try common content selectors
    main = (
        soup.find("main")
        or soup.find("article")
        or soup.find(id="content")
        or soup.find(class_=re.compile(r"content|docs|article|main", re.I))
        or soup.body
    )

    # Remove nav, header, footer, aside, script, style elements
    for tag in (main or soup).find_all(
        ["nav", "header", "footer", "aside", "script", "style", "noscript"]
    ):
        tag.decompose()

    return title, str(main) if main else str(soup.body or soup)


def html_to_markdown(html: str, page_url_path: str, local_file: Path) -> str:
    """Convert HTML to markdown, fixing links and images."""
    soup = BeautifulSoup(html, "html.parser")

    # Fix internal links
    for a in soup.find_all("a", href=True):
        href = a["href"]
        parsed = urllib.parse.urlparse(href)
        # Absolute internal link
        if parsed.netloc in ("", "developers.openai.com") and parsed.path.startswith("/api/docs"):
            a["href"] = local_rel_link(local_file, parsed.path)
        elif not parsed.netloc and href.startswith("/api/docs"):
            a["href"] = local_rel_link(local_file, parsed.path)

    # Fix images
    for img in soup.find_all("img", src=True):
        src = img["src"]
        parsed = urllib.parse.urlparse(src)
        if parsed.scheme in ("http", "https"):
            local_img = download_image(src)
            img["src"] = os.path.relpath(
                SAVE_ROOT / local_img, local_file.parent
            )
        elif src.startswith("/"):
            full = BASE_URL + src
            local_img = download_image(full)
            img["src"] = os.path.relpath(
                SAVE_ROOT / local_img, local_file.parent
            )

    md = markdownify.markdownify(
        str(soup),
        heading_style="ATX",
        bullets="-",
        code_language_callback=None,
    )
    # Collapse excessive blank lines
    md = re.sub(r"\n{3,}", "\n\n", md)
    return md.strip()


def fetch_page(url_path: str) -> Optional[Dict]:
    """Fetch a page, convert to markdown, save to disk. Returns page metadata."""
    url = BASE_URL + url_path
    if url_path in CRAWLED:
        print(f"  [skip duplicate] {url_path}")
        return None
    CRAWLED.add(url_path)

    local_file = path_to_local(url_path)
    if local_file.exists():
        print(f"  [skip existing]  {url_path}")
        # Still add to index
        md_text = local_file.read_text(encoding="utf-8")
        title_match = re.search(r"^#\s+(.+)$", md_text, re.MULTILINE)
        title = title_match.group(1) if title_match else url_path.split("/")[-1]
        return {"path": url_path, "title": title, "file": local_file}

    print(f"  [fetch]          {url}")
    try:
        resp = session.get(url, timeout=20, allow_redirects=True)
    except requests.RequestException as e:
        print(f"  [error]          {url}: {e}")
        return None

    if resp.status_code != 200:
        print(f"  [HTTP {resp.status_code}]       {url}")
        return None

    fetched_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    soup = BeautifulSoup(resp.text, "html.parser")
    title, main_html = extract_main_content(soup, url)

    md_body = html_to_markdown(main_html, url_path, local_file)

    # Build final markdown with frontmatter
    frontmatter = (
        f"---\n"
        f"source_url: {url}\n"
        f"fetched_at: {fetched_at}\n"
        f"---\n\n"
    )
    if title and not md_body.startswith("# "):
        md_body = f"# {title}\n\n{md_body}"

    full_md = frontmatter + md_body

    local_file.parent.mkdir(parents=True, exist_ok=True)
    local_file.write_text(full_md, encoding="utf-8")
    print(f"  [saved]          {local_file.relative_to(SAVE_ROOT)}")
    return {"path": url_path, "title": title or url_path.split("/")[-1], "file": local_file}


def generate_index(pages: list[dict]) -> None:
    """Generate index.md listing all crawled pages."""
    lines = [
        "# OpenAI API Documentation Index\n",
        f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}\n",
        f"Total pages: {len(pages)}\n",
        "\n---\n",
    ]

    # Group by top-level section
    sections: dict[str, list[dict]] = {}
    for p in pages:
        parts = p["path"].lstrip("/").split("/")
        # e.g. api/docs/guides/text -> section = "guides"
        if len(parts) >= 3:
            section = parts[2]  # 'guides', 'assistants', 'libraries', etc.
        else:
            section = "overview"
        sections.setdefault(section, []).append(p)

    index_file = SAVE_ROOT / "api" / "docs" / "index.md"

    for section, ps in sorted(sections.items()):
        lines.append(f"\n## {section.replace('-', ' ').title()}\n")
        for p in sorted(ps, key=lambda x: x["path"]):
            rel = os.path.relpath(p["file"], index_file.parent)
            lines.append(f"- [{p['title']}]({rel})")

    content = "\n".join(lines) + "\n"
    index_file.parent.mkdir(parents=True, exist_ok=True)
    index_file.write_text(content, encoding="utf-8")
    print(f"\n[index] Written → {index_file.relative_to(SAVE_ROOT)}")


def main():
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    SAVE_ROOT.mkdir(parents=True, exist_ok=True)

    print(f"Starting crawl of {len(ALL_PATHS)} pages…\n")
    pages = []
    for i, path in enumerate(ALL_PATHS, 1):
        print(f"[{i:3d}/{len(ALL_PATHS)}]")
        result = fetch_page(path)
        if result:
            pages.append(result)
        # Polite delay
        time.sleep(0.5)

    print(f"\nCrawled {len(pages)} pages successfully.")
    generate_index(pages)
    print("Done.")


if __name__ == "__main__":
    main()
