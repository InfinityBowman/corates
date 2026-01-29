# corates-ai

AI experiments for CoRATES -- structured data extraction from research papers using Google's [LangExtract](https://github.com/google/langextract).

## Prerequisites

- Python 3.11+
- [uv](https://docs.astral.sh/uv/getting-started/installation/) package manager
- A Google AI API key ([get one here](https://aistudio.google.com/apikey))

## Setup

From the `packages/ai` directory:

```bash
# Install dependencies and create the virtual environment
uv sync

# Copy the env template and add your API key
cp .env.example .env
# Edit .env and set GOOGLE_API_KEY
```

## Running the sample experiment

The sample experiment extracts study metadata (title, authors, study design, sample size, outcomes) from a hardcoded research abstract:

```bash
uv run python experiments/sample_extraction.py
```

This requires a valid `GOOGLE_API_KEY` in your `.env` file. The experiment uses Gemini 2.5 Flash by default.

## Project structure

```
packages/ai/
  pyproject.toml                    # Package config and dependencies
  .env.example                      # API key template
  AI_OPPORTUNITIES.md               # Writeup of AI opportunities for CoRATES
  src/
    corates_ai/
      __init__.py
      extraction.py                 # LangExtract extraction with few-shot examples
  experiments/
    sample_extraction.py            # Runnable sample extraction experiment
```

## Using the extraction module

The `corates_ai.extraction` module provides `extract_study_metadata`, which takes research paper text and returns structured extractions with source grounding:

```python
from corates_ai.extraction import extract_study_metadata

result = extract_study_metadata("your paper text here")
```

The function uses few-shot examples to teach LangExtract what to extract: title, authors, study design, sample size, population, and primary outcomes. You can modify the examples in `extraction.py` to change or expand what gets extracted.

To use a different model (e.g. Gemini 2.5 Pro for higher accuracy):

```python
result = extract_study_metadata(text, model_id="gemini-2.5-pro")
```

## Adding new experiments

Create new scripts in the `experiments/` directory. They can import from `corates_ai` directly:

```python
from dotenv import load_dotenv
from corates_ai.extraction import extract_study_metadata

load_dotenv()

# your experiment code
```

Run with `uv run python experiments/your_script.py`.

## Adding dependencies

```bash
uv add some-package
```

This updates `pyproject.toml` and `uv.lock` automatically.
