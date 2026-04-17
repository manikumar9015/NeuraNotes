"""
URL Scraper — extracts clean text content from web URLs.
Uses trafilatura for high-quality content extraction.
"""

from typing import Optional

import httpx


async def scrape_url(url: str) -> dict:
    """
    Scrape a URL and extract clean text content.
    
    Returns:
        dict with keys: content, title, author, publish_date, word_count
    """
    try:
        import trafilatura

        # Fetch the page
        async with httpx.AsyncClient(
            timeout=15.0,
            follow_redirects=True,
            headers={"User-Agent": "NeuraNotes/1.0 (Knowledge Capture Bot)"},
        ) as client:
            response = await client.get(url)

        if response.status_code != 200:
            raise Exception(f"Failed to fetch URL: HTTP {response.status_code}")

        html = response.text

        # Extract content using trafilatura
        extracted = trafilatura.extract(
            html,
            include_links=False,
            include_images=False,
            include_tables=True,
            include_comments=False,
            output_format="txt",
            favor_recall=True,  # Get more content even if some noise
        )

        if not extracted:
            raise Exception("Could not extract meaningful content from URL")

        # Extract metadata
        metadata = trafilatura.extract(
            html,
            output_format="xml",
            include_links=False,
        )

        # Try to get title from HTML
        title = None
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
            parser.feed(html[:5000])  # Only parse head section
            title = parser.title.strip() if parser.title.strip() else None
        except Exception:
            pass

        return {
            "content": extracted,
            "title": title,
            "author": None,
            "publish_date": None,
            "word_count": len(extracted.split()),
        }

    except ImportError:
        raise Exception("trafilatura is required for URL scraping: pip install trafilatura")
    except httpx.TimeoutException:
        raise Exception(f"Timeout while fetching URL: {url}")
    except Exception as e:
        raise Exception(f"URL scraping failed: {str(e)}")
