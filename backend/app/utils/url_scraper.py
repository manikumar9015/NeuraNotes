"""
URL Scraper — extracts clean text content from web URLs.
Uses a multi-tier fallback chain:
  1. trafilatura (best quality, works on articles/blogs)
  2. BeautifulSoup (broader compatibility)
  3. Raw regex strip (catches stubborn pages)
  4. Open Graph / meta tags (last resort for SPAs like Instagram)
"""

from typing import Optional

import httpx
import logging
import re

logger = logging.getLogger(__name__)

# Common browser User-Agent to avoid being blocked
BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)


async def _fetch_html(url: str) -> str:
    """Fetch raw HTML from a URL with browser-like headers."""
    async with httpx.AsyncClient(
        timeout=20.0,
        follow_redirects=True,
        headers={
            "User-Agent": BROWSER_UA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
    ) as client:
        response = await client.get(url)

    if response.status_code != 200:
        raise Exception(f"Failed to fetch URL: HTTP {response.status_code}")

    return response.text


def _extract_with_trafilatura(html: str) -> Optional[str]:
    """Primary extraction method using trafilatura."""
    try:
        import trafilatura

        extracted = trafilatura.extract(
            html,
            include_links=False,
            include_images=False,
            include_tables=True,
            include_comments=False,
            output_format="txt",
            favor_recall=True,
        )
        if extracted and len(extracted.strip()) > 30:
            return extracted.strip()
    except Exception as e:
        logger.warning(f"Trafilatura extraction failed: {e}")

    return None


def _extract_with_bs4(html: str) -> Optional[str]:
    """Fallback extraction using BeautifulSoup — more lenient."""
    try:
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "html.parser")

        # Remove script, style, noscript, iframe, svg elements
        for tag in soup(["script", "style", "noscript", "iframe", "svg"]):
            tag.decompose()

        # Try to find the main content area first
        main = (
            soup.find("main")
            or soup.find("article")
            or soup.find("div", {"role": "main"})
            or soup.find("div", class_=lambda c: c and any(
                kw in str(c).lower() for kw in ["content", "article", "post", "body", "entry"]
            ))
        )

        target = main if main else soup.body if soup.body else soup

        # Get text, collapse whitespace
        lines = []
        for line in target.get_text(separator="\n").splitlines():
            cleaned = line.strip()
            if cleaned and len(cleaned) > 2:
                lines.append(cleaned)

        text = "\n".join(lines)

        if len(text) > 30:
            return text

    except ImportError:
        logger.warning("beautifulsoup4 not installed, skipping BS4 fallback")
    except Exception as e:
        logger.warning(f"BS4 extraction failed: {e}")

    return None


def _extract_raw_text(html: str) -> Optional[str]:
    """
    Strip ALL HTML tags and grab whatever text exists.
    """
    try:
        text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<[^>]+>', ' ', text)
        import html as html_module
        text = html_module.unescape(text)
        lines = []
        for line in text.splitlines():
            cleaned = line.strip()
            if cleaned and len(cleaned) > 3:
                lines.append(cleaned)
        text = "\n".join(lines)

        if len(text) > 20:
            return text
    except Exception as e:
        logger.warning(f"Raw text extraction failed: {e}")

    return None


def _extract_meta_tags(html: str) -> Optional[dict]:
    """
    Extract Open Graph and standard meta tags from the HTML.
    This is the last resort for JavaScript-heavy SPAs (Instagram, Twitter, etc.)
    that embed some metadata as OG tags even without JS execution.
    
    Returns a dict with: title, description, image, site_name, type
    """
    meta = {}
    try:
        # Open Graph tags
        og_patterns = {
            "og_title": r'<meta\s+(?:[^>]*?)property=["\']og:title["\']\s+content=["\'](.*?)["\']',
            "og_description": r'<meta\s+(?:[^>]*?)property=["\']og:description["\']\s+content=["\'](.*?)["\']',
            "og_site_name": r'<meta\s+(?:[^>]*?)property=["\']og:site_name["\']\s+content=["\'](.*?)["\']',
            "og_type": r'<meta\s+(?:[^>]*?)property=["\']og:type["\']\s+content=["\'](.*?)["\']',
        }
        # Also try reversed attribute order (content before property)
        og_patterns_rev = {
            "og_title": r'<meta\s+(?:[^>]*?)content=["\'](.*?)["\']\s+(?:[^>]*?)property=["\']og:title["\']',
            "og_description": r'<meta\s+(?:[^>]*?)content=["\'](.*?)["\']\s+(?:[^>]*?)property=["\']og:description["\']',
            "og_site_name": r'<meta\s+(?:[^>]*?)content=["\'](.*?)["\']\s+(?:[^>]*?)property=["\']og:site_name["\']',
        }

        for key, pattern in og_patterns.items():
            match = re.search(pattern, html, re.IGNORECASE | re.DOTALL)
            if match:
                meta[key] = match.group(1).strip()

        # Try reversed order for any missing values
        for key, pattern in og_patterns_rev.items():
            if key not in meta:
                match = re.search(pattern, html, re.IGNORECASE | re.DOTALL)
                if match:
                    meta[key] = match.group(1).strip()

        # Standard meta description fallback
        if "og_description" not in meta:
            desc_match = re.search(
                r'<meta\s+(?:[^>]*?)name=["\']description["\']\s+content=["\'](.*?)["\']',
                html, re.IGNORECASE | re.DOTALL
            )
            if not desc_match:
                desc_match = re.search(
                    r'<meta\s+(?:[^>]*?)content=["\'](.*?)["\']\s+(?:[^>]*?)name=["\']description["\']',
                    html, re.IGNORECASE | re.DOTALL
                )
            if desc_match:
                meta["og_description"] = desc_match.group(1).strip()

        # Try JSON-LD structured data
        ld_match = re.search(
            r'<script\s+type=["\']application/ld\+json["\']\s*>(.*?)</script>',
            html, re.DOTALL | re.IGNORECASE
        )
        if ld_match:
            try:
                import json
                ld_data = json.loads(ld_match.group(1))
                if isinstance(ld_data, dict):
                    if "name" in ld_data and "og_title" not in meta:
                        meta["og_title"] = ld_data["name"]
                    if "description" in ld_data and "og_description" not in meta:
                        meta["og_description"] = ld_data["description"]
                    if "author" in ld_data:
                        author = ld_data["author"]
                        if isinstance(author, dict):
                            meta["author"] = author.get("name", str(author))
                        else:
                            meta["author"] = str(author)
            except Exception:
                pass

    except Exception as e:
        logger.warning(f"Meta tag extraction failed: {e}")

    return meta if meta else None


def _build_content_from_meta(meta: dict, url: str) -> Optional[str]:
    """Build a readable note from meta tag data."""
    parts = []

    site = meta.get("og_site_name", "")
    if site:
        parts.append(f"**Source:** {site}")

    desc = meta.get("og_description", "")
    if desc:
        import html as html_module
        desc = html_module.unescape(desc)
        parts.append(desc)

    og_type = meta.get("og_type", "")
    if og_type:
        parts.append(f"**Type:** {og_type}")

    author = meta.get("author", "")
    if author:
        parts.append(f"**Author:** {author}")

    parts.append(f"\n**Original URL:** {url}")

    if parts:
        return "\n\n".join(parts)

    return None


def _extract_title(html: str) -> Optional[str]:
    """Extract <title> from HTML head."""
    try:
        from html.parser import HTMLParser

        class TitleParser(HTMLParser):
            def __init__(self):
                super().__init__()
                self.in_title = False
                self.title = ""

            def handle_starttag(self, tag, attrs):
                if tag.lower() == "title":
                    self.in_title = True

            def handle_data(self, data):
                if self.in_title:
                    self.title += data

            def handle_endtag(self, tag):
                if tag.lower() == "title":
                    self.in_title = False

        parser = TitleParser()
        parser.feed(html[:5000])
        title = parser.title.strip()
        return title if title else None
    except Exception:
        return None


async def scrape_url(url: str) -> dict:
    """
    Scrape a URL and extract clean text content.

    Uses a 4-tier fallback chain:
    1. trafilatura (best quality)
    2. BeautifulSoup (broader compatibility)
    3. Raw regex strip (catches stubborn pages)
    4. Open Graph / meta tags (last resort for SPAs)

    Returns:
        dict with keys: content, title, author, publish_date, word_count
    """
    try:
        html = await _fetch_html(url)

        # Try trafilatura first (best quality)
        content = _extract_with_trafilatura(html)

        # Fallback to BeautifulSoup
        if not content:
            logger.info(f"Trafilatura failed for {url}, trying BS4")
            content = _extract_with_bs4(html)

        # Fallback to raw regex strip
        if not content:
            logger.info(f"BS4 failed for {url}, trying raw text")
            content = _extract_raw_text(html)

        # Last resort — Open Graph / meta tags (for SPAs like Instagram/Twitter)
        title = _extract_title(html)
        meta = _extract_meta_tags(html)

        if not content and meta:
            logger.info(f"Using meta tag data for {url}")
            content = _build_content_from_meta(meta, url)
            # Use OG title if we don't have one
            if not title and meta.get("og_title"):
                title = meta["og_title"]

        # If we got OG title but no HTML title, use OG
        if not title and meta and meta.get("og_title"):
            title = meta["og_title"]

        if not content:
            raise Exception(
                "Could not extract any text content from this URL. "
                "The page may require JavaScript rendering or login."
            )

        return {
            "content": content,
            "title": title,
            "author": meta.get("author") if meta else None,
            "publish_date": None,
            "word_count": len(content.split()),
        }

    except httpx.TimeoutException:
        raise Exception(f"Timeout while fetching URL (>20s): {url}")
    except Exception as e:
        if "Could not extract" in str(e):
            raise
        raise Exception(f"URL scraping failed: {str(e)}")
