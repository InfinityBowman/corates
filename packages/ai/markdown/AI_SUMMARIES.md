# AI-Assisted Summaries for Systematic Reviews

## The Opportunity

After a review team has appraised all included studies, extracted data, and reconciled disagreements, they face a writing phase. This phase involves synthesizing their structured assessments into narrative prose for the final publication. It is time-consuming, repetitive in structure, and follows predictable conventions.

CoRATES already holds all the structured data needed to generate draft sections of a systematic review:

- Completed and reconciled AMSTAR2 / ROB2 / ROBINS-I checklists per study
- Per-question answers with notes and supporting evidence
- Domain-level and overall risk of bias judgments
- Study metadata (extracted or entered by reviewers)
- Reconciliation outcomes (where reviewers agreed and disagreed)

This structured data can feed an LLM to produce first-draft narrative sections that reviewers edit and refine rather than write from scratch.

## Which Sections Can Be AI-Assisted

### 1. Risk of Bias Narrative

**What reviewers currently write:**
A paragraph or section describing the overall risk of bias findings across included studies. Typically structured by bias domain, noting how many studies were rated low, some concerns, or high risk for each domain, with specific studies highlighted for notable issues.

**Example output:**

> "Risk of bias was assessed using the ROB2 tool for the 12 included RCTs. For the randomization process (Domain 1), 9 studies were rated low risk, 2 had some concerns due to unclear allocation concealment, and 1 was rated high risk due to a non-random allocation method (Smith 2019). Deviations from intended interventions (Domain 2) were a greater concern: 4 studies were rated high risk, primarily due to unblinded participants and care providers in behavioral intervention trials. Missing outcome data (Domain 3) was generally well-handled, with 11 studies rated low risk..."

**What the AI needs:**

- All ROB2 checklists with domain judgments per study
- Study identifiers (first author, year)
- Reviewer notes explaining specific judgments

**Why this works well:**
The narrative follows a rigid pattern (domain by domain, counting judgments, highlighting outliers). The structured data maps directly to the output. There is minimal interpretive risk -- the AI is translating structured assessments into standard prose, not making new judgments.

### 2. Characteristics of Included Studies

**What reviewers currently write:**
A summary describing the range of study designs, populations, interventions, comparators, sample sizes, settings, and follow-up periods across included studies. Often accompanies a characteristics table.

**Example output:**

> "The 15 included studies comprised 8 RCTs, 4 prospective cohort studies, and 3 cross-sectional studies, published between 2015 and 2023. Total sample sizes ranged from 45 to 2,340 participants (median 312). Ten studies were conducted in high-income countries (5 in the US, 3 in the UK, 1 in Australia, 1 in Canada), and 5 in middle-income countries (3 in Brazil, 1 in Turkey, 1 in Thailand). The mean age of participants ranged from 24 to 67 years. Interventions included cognitive behavioral therapy (n=6), mindfulness-based programs (n=5), pharmacological treatments (n=3), and exercise interventions (n=1)..."

**What the AI needs:**

- Study metadata per included study (design, sample size, country, population demographics, intervention type, comparator, outcomes, follow-up duration)
- This data could come from AI extraction (LangExtract) or manual entry

**Why this works well:**
This is descriptive summarization of structured data. No judgment is required. The AI counts, groups, and describes ranges. The output is verifiable against the characteristics table.

### 3. Summary of Findings

**What reviewers currently write:**
A narrative synthesis of the main results, organized by outcome. For each outcome, describes the number of studies reporting it, the direction and magnitude of effects, heterogeneity, and the quality of evidence.

**Example output:**

> "Seven studies reported on depression outcomes at post-intervention. The pooled standardized mean difference favored the intervention group (SMD = -0.42, 95% CI -0.61 to -0.23, p < 0.001, I-squared = 34%). Sensitivity analysis excluding the two studies at high risk of bias produced similar results (SMD = -0.38, 95% CI -0.59 to -0.17). The certainty of evidence was rated moderate (GRADE), downgraded for some concerns about risk of bias."

**What the AI needs:**

- Effect estimates per study per outcome (from extraction or manual entry)
- Meta-analysis results (pooled estimates, heterogeneity statistics)
- GRADE assessments if available
- Sensitivity/subgroup analysis results

**Why this is harder:**
This requires numerical accuracy. If the AI states "SMD = -0.42" it must be exactly right. The safest approach is to have the AI compose the narrative structure around placeholder values that are filled from the structured data, rather than having the AI generate the numbers itself. The AI writes the connective prose; the numbers come from the data.

### 4. Strengths and Limitations

**What reviewers currently write:**
A discussion section covering methodological strengths (comprehensive search, dual review, pre-registered protocol) and limitations (language restrictions, missing data, heterogeneity) of the review itself.

**Example output:**

> "This review has several strengths. The search strategy was comprehensive, covering five databases and grey literature sources with no language restrictions. Study selection and data extraction were performed independently by two reviewers, with high inter-rater agreement (kappa = 0.87). Risk of bias was assessed using validated tools (ROB2 for RCTs, ROBINS-I for cohort studies). Limitations include the high heterogeneity observed for the primary outcome, which could not be fully explained by pre-specified subgroup analyses. Additionally, the small number of studies limited our ability to assess publication bias."

**What the AI needs:**

- The review's own methodology (from the protocol or AMSTAR2 self-assessment)
- Reconciliation statistics (agreement rates)
- Meta-analysis heterogeneity results
- Number of included studies
- Any search restrictions applied

**Why this works well:**
Strengths and limitations follow predictable patterns. CoRATES has the data to support most of these statements directly (dual review is inherent to the platform, reconciliation statistics are computed, search strategy details are in the protocol).

### 5. Abstract

**What reviewers currently write:**
A structured abstract following journal requirements (Background, Methods, Results, Conclusions). This is typically the last section written because it summarizes the entire review.

**What the AI needs:**

- All of the above sections as input
- The review question / objective
- Journal-specific format requirements

**Why this is valuable:**
The abstract is the most-read part of any paper. Getting it right matters. An AI draft gives reviewers a starting point that covers all required elements, reducing the risk of accidentally omitting a key finding. The reviewer edits for precision and tone.

## How It Would Work in CoRATES

### Data Collection Phase

As reviewers work through their checklists and data extraction, CoRATES accumulates structured data:

```
Project
  |
  +-- Studies[]
  |     |
  |     +-- Metadata (title, authors, year, design, etc.)
  |     +-- PDF (uploaded)
  |     +-- AI Extraction results (passages, tables, figures)
  |     +-- Checklists[]
  |     |     +-- Reviewer 1 assessment
  |     |     +-- Reviewer 2 assessment
  |     |     +-- Reconciled assessment
  |     +-- Extracted data (PICO, effect sizes, etc.)
  |
  +-- Project-level data
        +-- Review question / protocol
        +-- Meta-analysis results (if applicable)
        +-- GRADE assessments (if applicable)
```

### Summary Generation

Once appraisals are complete (or at any point during the review), the reviewer can request AI-generated summaries. The generation happens per section:

```
+------------------------------------------------------------------+
| Generate Review Summaries                                        |
|                                                                  |
| Available sections:                                              |
|                                                                  |
| [x] Risk of bias narrative          [Generate]                   |
|     12/12 studies appraised with ROB2                            |
|     Status: Ready                                                |
|                                                                  |
| [x] Characteristics of included studies  [Generate]              |
|     12/12 studies with metadata                                  |
|     Status: Ready                                                |
|                                                                  |
| [ ] Summary of findings                  [Generate]              |
|     Effect data available for 8/12 studies                       |
|     Status: Partial data -- review before generating             |
|                                                                  |
| [ ] Strengths and limitations            [Generate]              |
|     Status: Ready                                                |
|                                                                  |
| [ ] Abstract                             [Generate]              |
|     Depends on: other sections generated first                   |
|     Status: Waiting                                              |
|                                                                  |
+------------------------------------------------------------------+
```

Each section is generated independently. The reviewer can generate, read, edit, and regenerate as needed. The AI output is a starting draft, not a final product.

### Editing Interface

Generated summaries open in an editor where the reviewer can:

- Edit the text directly
- See which structured data each sentence references (similar to the evidence panel in checklist view)
- Flag sentences they are unsure about
- Regenerate specific paragraphs with additional instructions
- Export the final text for inclusion in their manuscript

```
+------------------------------------------------------------------+
| Risk of Bias Narrative                               [Regenerate]|
|                                                                  |
| Risk of bias was assessed using the ROB2 tool for the 12         |
| included RCTs. For the randomization process (Domain 1),         |
| 9 studies were rated low risk, 2 had some concerns due to        |
| unclear allocation concealment (Park 2021, Chen 2020), and       |
| 1 was rated high risk due to a non-random allocation method      |
| (Smith 2019).                                          [3 refs]  |
|                                                                  |
| Deviations from intended interventions (Domain 2) were a         |
| greater concern: 4 studies were rated high risk, primarily due   |
| to unblinded participants and care providers in behavioral       |
| intervention trials (Jones 2018, Lee 2020, Kim 2021,             |
| Williams 2022).                                        [4 refs]  |
|                                                                  |
| ...                                                              |
|                                                                  |
| [ref] markers link to the specific checklist data supporting     |
| each claim. Click to see the reconciled ROB2 assessment.         |
+------------------------------------------------------------------+
```

The [ref] markers are the trust mechanism. Every factual claim in the generated text links back to the structured data that supports it. If a reviewer questions whether "2 had some concerns" is correct, they click the reference and see the actual ROB2 judgments for Park 2021 and Chen 2020.

## The Trust Problem for Summaries

Summaries are generative -- the AI produces new text, not just extracted passages. This introduces different risks than extraction:

**Numerical errors.** The AI might write "9 studies" when the correct count is 8. Mitigation: all numbers should be computed from structured data and inserted into the narrative, not generated by the LLM. The LLM writes the connective prose; the data layer provides the facts.

**Misattribution.** The AI might attribute a finding to the wrong study. Mitigation: every study-specific claim must reference the underlying data. The [ref] links make misattribution detectable.

**Inappropriate interpretation.** The AI might characterize heterogeneity as "substantial" when I-squared is 40%, which some would consider moderate. Mitigation: use established thresholds (Cochrane guidelines: 0-40% low, 30-60% moderate, 50-90% substantial, 75-100% considerable) and let reviewers adjust the characterization.

**Omission.** The AI might not mention a notable finding that reviewers consider important. Mitigation: the generation UI shows which studies and data points were included in the summary. Reviewers can identify omissions by comparing against the structured data.

**Tone and framing.** Academic writing has conventions around hedging, causal language, and confidence. "The intervention reduced depression" vs. "The intervention was associated with lower depression scores." Mitigation: the AI should default to conservative, observational language. Reviewers can strengthen claims where the evidence warrants it.

### The Key Principle

The AI produces the first draft. The reviewer produces the final version. The structured data is the source of truth. Every claim in the summary must be traceable to the data. The AI's job is to save the reviewer from staring at a blank page, not to produce a publication-ready manuscript.

## Building for Improving Models

Current models produce adequate first drafts for structured sections (risk of bias narratives, characteristics summaries). They struggle more with nuanced interpretation (discussion sections, implications for practice).

As models improve:

- **Better numerical reasoning** reduces the need to inject numbers from the data layer. The model could eventually compute counts and ranges itself from the raw data.
- **Better academic writing** produces drafts that need less editing for tone and convention.
- **Longer context windows** allow the model to consider all studies simultaneously rather than summarizing in batches.
- **Better citation handling** enables automatic reference formatting and cross-referencing.

The architecture does not need to change. The generation prompts get simpler as models get smarter, but the trust mechanisms (data references, reviewer editing, structured data as source of truth) remain valuable regardless of model capability. Even a perfect model benefits from an audit trail that connects narrative claims to underlying data.

## What This Does Not Cover

**Meta-analysis computation.** The AI does not run meta-analyses. It describes results that were computed elsewhere (in R, Stata, RevMan, or a future CoRATES feature). Statistical computation requires exact numerical methods, not language models.

**GRADE assessments.** Grading the certainty of evidence requires methodological judgment that goes beyond summarization. The AI could eventually assist with GRADE (suggesting downgrade reasons based on risk of bias findings), but this is a separate capability from summary generation.

**Journal formatting.** Different journals have different requirements for structure, word limits, reference formatting, and table/figure placement. The AI generates content; formatting for a specific journal is a separate step.

**Supplementary materials.** Search strategies, full RoB tables, forest plots, and other supplementary materials are typically formatted rather than written. These are better served by export/formatting features than by LLM generation.
