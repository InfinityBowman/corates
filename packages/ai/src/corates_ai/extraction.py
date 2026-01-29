"""Study metadata extraction from research paper text using LangExtract."""

import os

import langextract as lx


STUDY_EXTRACTION_PROMPT = (
    "Extract study metadata from the research paper text. "
    "Identify the study title, authors, study design, sample size, "
    "primary outcomes, and population characteristics in order of appearance."
)

STUDY_EXTRACTION_EXAMPLES = [
    lx.data.ExampleData(
        text=(
            "A Randomized Controlled Trial of Cognitive Behavioral Therapy "
            "for Chronic Pain in Older Adults\n"
            "Smith J, Johnson A, Williams B\n"
            "We enrolled 120 participants aged 65 and older with chronic "
            "musculoskeletal pain lasting more than 3 months. Participants "
            "were randomly assigned to CBT (n=60) or usual care (n=60). "
            "The primary outcome was pain intensity measured by the Brief "
            "Pain Inventory at 12 weeks."
        ),
        extractions=[
            lx.data.Extraction(
                extraction_class="title",
                extraction_text=(
                    "A Randomized Controlled Trial of Cognitive Behavioral "
                    "Therapy for Chronic Pain in Older Adults"
                ),
                attributes={},
            ),
            lx.data.Extraction(
                extraction_class="authors",
                extraction_text="Smith J, Johnson A, Williams B",
                attributes={},
            ),
            lx.data.Extraction(
                extraction_class="study_design",
                extraction_text="Randomized Controlled Trial",
                attributes={"abbreviation": "RCT"},
            ),
            lx.data.Extraction(
                extraction_class="sample_size",
                extraction_text="120 participants",
                attributes={
                    "intervention_group": "60",
                    "control_group": "60",
                },
            ),
            lx.data.Extraction(
                extraction_class="population",
                extraction_text="aged 65 and older with chronic musculoskeletal pain",
                attributes={"age_group": "65+", "condition": "chronic pain"},
            ),
            lx.data.Extraction(
                extraction_class="primary_outcome",
                extraction_text="pain intensity measured by the Brief Pain Inventory",
                attributes={"timepoint": "12 weeks"},
            ),
        ],
    ),
]


def extract_study_metadata(
    text: str,
    model_id: str = "gemini-2.5-flash",
    api_key: str | None = None,
) -> lx.data.AnnotatedDocument:
    """Extract structured study metadata from research paper text.

    Args:
        text: The research paper text to extract from.
        model_id: The LLM model to use for extraction.
        api_key: Google AI API key. Falls back to GOOGLE_API_KEY env var.

    Returns:
        An AnnotatedDocument containing the extracted study metadata.
    """
    if api_key is None:
        api_key = os.environ.get("GOOGLE_API_KEY")

    result = lx.extract(
        text_or_documents=text,
        prompt_description=STUDY_EXTRACTION_PROMPT,
        examples=STUDY_EXTRACTION_EXAMPLES,
        model_id=model_id,
        api_key=api_key,
    )
    return result
