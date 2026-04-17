"""
PDF Parser — extracts text content from PDF files.
Uses PyMuPDF (fitz) for reliable PDF text extraction.
"""


def parse_pdf(file_bytes: bytes) -> dict:
    """
    Parse a PDF and extract text content.
    
    Returns:
        dict with keys: content, title, page_count
    """
    try:
        import fitz  # PyMuPDF

        doc = fitz.open(stream=file_bytes, filetype="pdf")

        pages_text = []
        for page_num in range(doc.page_count):
            page = doc.load_page(page_num)
            text = page.get_text("text")
            if text.strip():
                pages_text.append(text.strip())

        doc.close()

        if not pages_text:
            raise Exception("Could not extract any text from PDF")

        content = "\n\n".join(pages_text)

        # Try to extract title from metadata or first line
        title = None
        try:
            metadata = doc.metadata
            if metadata and metadata.get("title"):
                title = metadata["title"]
        except Exception:
            pass

        if not title:
            first_line = content.strip().split("\n")[0][:100]
            title = first_line if first_line else "PDF Document"

        return {
            "content": content,
            "title": title,
            "page_count": doc.page_count,
        }

    except ImportError:
        raise Exception("PyMuPDF is required for PDF parsing: pip install pymupdf")
    except Exception as e:
        raise Exception(f"PDF parsing failed: {str(e)}")
