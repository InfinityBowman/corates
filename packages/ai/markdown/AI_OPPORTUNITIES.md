# AI Opportunities for CoRATES

This document outlines areas where AI can augment the CoRATES evidence synthesis workflow, with a focus on practical applications using structured extraction, language models, and document understanding.

## 1. Automated Data Extraction from Research PDFs

**Problem:** Reviewers manually read each included study and transcribe key data points (sample sizes, effect sizes, population characteristics, intervention details) into evidence tables. This is slow and error-prone.

**Approach:** Use LangExtract (or similar structured extraction tools) to process full-text PDFs and pull out study-level metadata with source grounding. Each extracted field maps back to its exact location in the source document, enabling verification.

**Extracted fields:**

- Study identifiers (title, authors, year, DOI)
- Study design (RCT, cohort, case-control, etc.)
- Sample size and allocation
- Population demographics and eligibility criteria
- Intervention and comparator details
- Outcome measures and timepoints
- Effect estimates with confidence intervals
- Funding sources and conflict of interest disclosures

**Value:** Reduces extraction time per study from ~30 minutes to a review-and-confirm step. Source grounding means reviewers can click on any extracted value and see the original passage.

## 2. PICO Extraction

**Problem:** Defining the Population, Intervention, Comparison, and Outcome (PICO) for each study is a core task in systematic reviews. Doing this consistently across dozens or hundreds of studies is tedious.

**Approach:** Train extraction examples on PICO elements specifically. LangExtract's example-driven approach is well suited here -- a small number of well-annotated examples can define the schema, and the model generalizes across study types.

**Value:** Pre-populated PICO tables that reviewers validate rather than create from scratch. Consistency across reviewers improves because the same extraction logic is applied to every study.

## 3. Checklist Pre-filling (AMSTAR2 / ROBINS-I / ROB2)

**Problem:** Quality appraisal checklists require reviewers to evaluate specific methodological criteria and provide supporting text. Reviewers must locate relevant passages in the paper for each checklist item.

**Approach:** For each checklist question, use extraction to find passages in the paper that are relevant to that criterion. Present the passages alongside the question so reviewers have the evidence in front of them when making their judgment.

**Examples:**

- AMSTAR2 Item 2 ("Was the review protocol registered?"): Extract sentences mentioning PROSPERO, protocol registration, or pre-registration
- ROBINS-I Domain 1 ("Bias due to confounding"): Extract passages about confounders, adjustment variables, matching, or propensity scores
- ROB2 Domain 1 ("Randomisation process"): Extract text about randomisation method, allocation concealment, and baseline differences

**Value:** Does not replace reviewer judgment, but eliminates the time spent hunting for relevant passages. Reviewers focus on interpretation rather than information retrieval.

## 4. Reconciliation Assistance

**Problem:** When two reviewers disagree on a checklist item, they must reconcile by discussing the evidence. Currently, they have to re-read the paper to find the passages that support their respective judgments.

**Approach:** When a disagreement is detected, automatically surface the text passages that are most relevant to the checklist item in question. Highlight sections of the paper that each reviewer may have weighted differently.

**Value:** Faster reconciliation meetings. Disagreements are grounded in specific text rather than memory, reducing bias toward the more confident reviewer.

## 5. Evidence Table Generation

**Problem:** After data extraction, reviewers must format their findings into standardized evidence tables (characteristics of included studies, summary of findings, etc.). This formatting step is manual and repetitive.

**Approach:** Given extracted study data, auto-generate formatted evidence tables in the structure required by the review protocol. Support common formats (Cochrane, GRADE summary of findings, custom templates).

**Value:** Eliminates formatting busywork. Reviewers edit a generated table rather than building one from scratch.

## Technical Notes

- **LangExtract** is the starting point for extraction experiments in this package. It provides source grounding out of the box, which is critical for a review tool where auditability matters.
- **Model selection:** Gemini 2.5 Flash offers a good balance of speed and quality for extraction tasks. Gemini 2.5 Pro can be used for higher-stakes extraction where accuracy is paramount.
- **API keys:** Extraction requires a Google AI API key. See `.env.example` for setup.
- **Privacy:** Research papers may contain sensitive data. All processing should respect data handling policies. On-premise or self-hosted model options (via Ollama) are available in LangExtract for cases where data cannot leave the organization.

## Next Steps

1. Run the sample extraction experiment (`experiments/sample_extraction.py`) to validate the approach
2. Test extraction on actual systematic review papers relevant to CoRATES
3. Define extraction schemas for PICO elements and checklist-relevant passages
4. Evaluate extraction accuracy against human-extracted data
5. Explore integration points with the CoRATES web application (API endpoints for extraction, results display in the UI)
