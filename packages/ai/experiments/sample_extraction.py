"""Sample experiment: extract study metadata from a research paper abstract.

Usage:
    1. Copy .env.example to .env and fill in your API key
    2. Run: uv run python experiments/sample_extraction.py
"""

import os

from dotenv import load_dotenv

from corates_ai.extraction import extract_study_metadata

load_dotenv()

SAMPLE_ABSTRACT = """
Effectiveness of Mindfulness-Based Stress Reduction for Anxiety
in Primary Care: A Pragmatic Randomized Trial

Chen L, Park S, Rodriguez M, Kim H

Background: Anxiety disorders are common in primary care settings, yet
access to evidence-based psychological treatments remains limited.
Mindfulness-based stress reduction (MBSR) has shown promise, but
few trials have examined its effectiveness in routine clinical practice.

Methods: We conducted a pragmatic randomized controlled trial across
12 primary care clinics. Adults (aged 18-75) with generalized anxiety
disorder (GAD-7 score >= 10) were randomized to 8-week MBSR (n=156)
or enhanced usual care (n=148). The primary outcome was change in
GAD-7 score at 6 months. Secondary outcomes included depression
(PHQ-9), quality of life (SF-12), and healthcare utilization.

Results: At 6 months, the MBSR group showed significantly greater
reduction in GAD-7 scores compared with usual care (mean difference
-3.2, 95% CI -4.1 to -2.3, p<0.001). Improvements were sustained
at 12-month follow-up. Number needed to treat for clinically
meaningful response was 4 (95% CI 3 to 6).

Conclusions: MBSR delivered in primary care settings significantly
reduces anxiety symptoms compared with usual care, with effects
maintained over 12 months.
"""


def main():
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("Error: Set GOOGLE_API_KEY in your .env file.")
        print("See .env.example for details.")
        return

    print("Extracting study metadata from sample abstract...")
    print("-" * 60)

    result = extract_study_metadata(SAMPLE_ABSTRACT)

    if hasattr(result, "__iter__"):
        documents = list(result)
    else:
        documents = [result]

    for doc in documents:
        if not hasattr(doc, "extractions"):
            continue
        for extraction in doc.extractions:
            print(f"[{extraction.extraction_class}]")
            print(f"  Text: {extraction.extraction_text}")
            if extraction.attributes:
                for key, value in extraction.attributes.items():
                    print(f"  {key}: {value}")
            print()


if __name__ == "__main__":
    main()
