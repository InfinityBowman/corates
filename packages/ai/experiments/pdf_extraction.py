"""Extract study metadata from research paper PDFs.

Usage:
    1. Copy .env.example to .env and fill in your API key
    2. Place PDF files in the pdfs/ directory
    3. Run on all PDFs:       uv run python experiments/pdf_extraction.py
       Run on a single PDF:   uv run python experiments/pdf_extraction.py pdfs/some_paper.pdf

Results are saved as JSON in the output/ directory.
"""

import json
import os
import re
import sys
from pathlib import Path

import pymupdf
from dotenv import load_dotenv

from corates_ai.extraction import extract_study_metadata

load_dotenv()

PDFS_DIR = Path(__file__).resolve().parent.parent / "pdfs"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "output"


_REFERENCES_PATTERN = re.compile(
    r"^\s*(References|Bibliography|Works Cited|Literature Cited)\s*$",
    re.MULTILINE | re.IGNORECASE,
)


def extract_text_from_pdf(pdf_path: str | Path) -> str:
    """Extract body text from a PDF, stripping the references section."""
    doc = pymupdf.open(pdf_path)
    pages = []
    for page in doc:
        pages.append(page.get_text())
    doc.close()
    text = "\n".join(pages)

    match = _REFERENCES_PATTERN.search(text)
    if match:
        text = text[: match.start()]

    return text


def extractions_to_dicts(result) -> list[dict]:
    """Convert LangExtract result into a list of plain dicts."""
    if hasattr(result, "__iter__"):
        documents = list(result)
    else:
        documents = [result]

    entries = []
    for doc in documents:
        if not hasattr(doc, "extractions"):
            continue
        for ext in doc.extractions:
            entries.append({
                "class": ext.extraction_class,
                "text": ext.extraction_text,
                "attributes": dict(ext.attributes) if ext.attributes else {},
            })
    return entries


def process_pdf(pdf_path: Path):
    """Extract text from a PDF and run study metadata extraction."""
    print(f"Processing: {pdf_path.name}")
    print("=" * 60)

    text = extract_text_from_pdf(pdf_path)
    word_count = len(text.split())
    print(f"Extracted {word_count} words from {len(text)} characters")
    print()

    preview = text[:500].strip()
    print(f"Text preview:\n{preview}")
    print("...")
    print()

    print("Running LangExtract...")
    print("-" * 60)

    result = extract_study_metadata(text)
    entries = extractions_to_dicts(result)

    if entries:
        for entry in entries:
            print(f"[{entry['class']}]")
            print(f"  Text: {entry['text']}")
            for key, value in entry["attributes"].items():
                print(f"  {key}: {value}")
            print()
    else:
        print("No extractions found.")

    # Save JSON output
    OUTPUT_DIR.mkdir(exist_ok=True)
    out_name = pdf_path.stem + ".json"
    out_path = OUTPUT_DIR / out_name
    with open(out_path, "w") as f:
        json.dump({"source": pdf_path.name, "extractions": entries}, f, indent=2)
    print(f"Results saved to {out_path}")
    print()


def main():
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("Error: Set GOOGLE_API_KEY in your .env file.")
        print("See .env.example for details.")
        return

    if len(sys.argv) > 1:
        pdf_path = Path(sys.argv[1])
        if not pdf_path.exists():
            print(f"Error: File not found: {pdf_path}")
            return
        process_pdf(pdf_path)
        return

    if not PDFS_DIR.exists():
        print(f"Error: No pdfs/ directory found at {PDFS_DIR}")
        print("Create it and add some PDF files, or pass a PDF path as an argument.")
        return

    pdf_files = sorted(PDFS_DIR.glob("*.pdf"))
    if not pdf_files:
        print(f"No PDF files found in {PDFS_DIR}")
        return

    print(f"Found {len(pdf_files)} PDF(s)")
    print()

    for pdf_path in pdf_files:
        process_pdf(pdf_path)


if __name__ == "__main__":
    main()
