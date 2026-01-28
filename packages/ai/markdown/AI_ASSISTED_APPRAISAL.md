# AI-Assisted Appraisal: Full Pipeline and UX Vision

## Design Principles

**1. Evidence-first, not answer-first.**
The AI surfaces relevant passages from the paper. The reviewer reads them and decides. Suggested answers are available but never presented before the evidence. This prevents anchoring bias -- the tendency to accept a suggestion without critically evaluating it.

**2. Every AI output is traceable to source text.**
Nothing the AI produces should be detached from a specific location in the paper. If the AI says "protocol was registered," it must point to the exact sentence. If a reviewer cannot click through and verify, the output is not trustworthy enough to include.

**3. Absence is information, not silence.**
When the AI finds no evidence for a criterion, it should explicitly say so. "No mention of grey literature searching found" is more useful than an empty panel. This helps reviewers distinguish between "the paper doesn't report this" and "the AI didn't look for this."

**4. The system should get better over time.**
Reviewer decisions (accepting, rejecting, or modifying AI suggestions) are training signal. The platform should capture this feedback loop even if it is not used immediately. When models improve, this data becomes valuable for evaluation and fine-tuning.

**5. Build for the AI of two years from now.**
Current models produce noisy extraction with duplicates and sometimes miss relevant passages. Future models will be more precise. The architecture should not bake in workarounds for current limitations -- instead, design clean interfaces that will benefit from improved models without rework.

---

## The Full Pipeline

```
PDF Upload
    |
    v
[Pre-Processing]
    |  - Text extraction with structure preservation
    |  - Section classification (methods, results, discussion, etc.)
    |  - Table detection and structured extraction
    |  - Reference section removal
    |
    v
[Extraction - LangExtract]
    |  - Checklist-aware passage extraction
    |  - Source grounding (char offsets in original text)
    |  - Multiple extraction classes per checklist type
    |
    v
[Post-Processing - LLM Reasoning]
    |  - Deduplication and consolidation
    |  - Map passages to specific checklist questions and sub-criteria
    |  - Detect absence (criteria with no supporting passages)
    |  - Generate per-question evidence summary
    |  - Suggest answer with justification (constrained to extracted passages only)
    |  - Confidence scoring
    |
    v
[Storage]
    |  - Cache results per study per checklist type
    |  - Store alongside Y.js checklist data
    |
    v
[UI Presentation]
       - Evidence panel in checklist view
       - PDF highlighting
       - Reconciliation context
```

### Pre-Processing

**Text extraction** is what we have now (PyMuPDF), with the references section stripped. But there are improvements worth making:

**Section classification.** Research papers follow a predictable structure: Abstract, Introduction/Background, Methods, Results, Discussion, Conclusion. Identifying these sections helps in two ways:

- The extraction can be focused on the Methods section, where most AMSTAR2-relevant information lives. This reduces noise from the Results and Discussion sections.
- When presenting evidence to reviewers, showing "from Methods section" is more useful than a raw character offset.

Section headers are usually identifiable by formatting (bold, larger font) or by common labels. PyMuPDF exposes font metadata per text block, which can be used for this. Alternatively, a simple heuristic on common header patterns works for most papers.

**Table extraction.** Some AMSTAR2-relevant information lives in tables -- characteristics of included studies (Q8), risk of bias summaries (Q9), or forest plot data (Q11). PyMuPDF can extract table structures, but the output is often messy. For now, tables can be included as raw text. As document understanding models improve, structured table extraction will get better without changing the pipeline architecture.

**Reference removal** is already implemented. Could also strip acknowledgments, author contribution statements, and supplementary material notices, since these rarely contain AMSTAR2-relevant content.

### Extraction (LangExtract)

The extraction step uses LangExtract with AMSTAR2-specific few-shot examples. The extraction classes map to methodological reporting elements rather than generic study metadata.

Example extraction classes for AMSTAR2:

```
protocol_registration      - PROSPERO ID, protocol DOI, pre-registration statement
search_databases            - Names of databases searched
search_strategy             - Search terms, keywords, MeSH headings
search_dates                - Date range of literature search
search_restrictions         - Language or publication type restrictions
grey_literature             - Grey literature sources searched
reference_checking          - Hand-searching of reference lists
expert_consultation         - Content expert involvement
reviewer_independence       - Number of independent reviewers, screening process
data_extraction_process     - Duplicate extraction, consensus process
exclusion_list              - Excluded studies mentioned, justification
study_descriptions          - Level of detail for included studies
rob_tool                    - Name of risk of bias tool used
rob_domains                 - Which bias domains were assessed
funding_reporting           - Funding sources of included studies
statistical_methods         - Meta-analysis methods, models, software
heterogeneity_assessment    - I-squared, Q-test, subgroup analyses
publication_bias            - Funnel plots, Egger's test, trim-and-fill
coi_disclosure              - Conflict of interest statements
pico_population             - Population specification
pico_intervention           - Intervention specification
pico_comparator             - Comparator specification
pico_outcome                - Outcome specification
study_design_justification  - Rationale for included study designs
```

Each extraction includes the verbatim text and its character offset in the source. This grounding is what makes the downstream reasoning step trustworthy -- the LLM can only reference passages that actually exist in the paper.

### Post-Processing (LLM Reasoning)

This is the step that turns raw extracted passages into actionable checklist assistance. The reasoning LLM receives:

**Inputs:**

- The AMSTAR2 question text and sub-criteria (from the schema)
- All extracted passages relevant to this question (from LangExtract)
- The question's guidance text (the `info` field from the schema)

**Outputs per question:**

- **Evidence summary**: A brief narrative of what was found and what was not found
- **Sub-criteria coverage**: For each sub-criterion, whether supporting evidence was found, with the specific passage(s)
- **Suggested answer**: Yes / Partial Yes / No, with explicit justification referencing only the extracted passages
- **Confidence**: How confident the AI is in its suggestion (high / moderate / low)
- **Gaps**: Sub-criteria where no evidence was found

**Critical constraint:** The reasoning LLM must not introduce information that is not in the extracted passages. Its job is to _interpret_ and _organize_ the extraction results against the checklist criteria, not to add new claims. This is what prevents hallucination at the reasoning layer -- the extraction layer provides grounded passages, and the reasoning layer is constrained to those passages.

If the extraction missed something, the reasoning step will correctly report "no evidence found" for that criterion. This is preferable to the reasoning LLM fabricating evidence. The reviewer can then check the paper manually for that specific criterion.

**Deduplication** happens here as well. Multiple chunks may extract the same passage. The reasoning step consolidates these into unique evidence items.

---

## What the Reviewer Sees

### Workflow Overview

1. Reviewer opens a study in the project
2. If AI analysis has not been run, they see an "Analyze with AI" button
3. Analysis runs in the background (progress shown in status bar)
4. Once complete, AI evidence is available on every checklist question
5. Reviewer works through the checklist normally, with AI evidence alongside
6. When done, submits the completed checklist as usual

The AI analysis is run once per study and cached. Reviewers can re-run it if the PDF is updated or if they want to try with a different model.

### The Checklist Question View

The existing layout is a split-screen: checklist on the left, PDF viewer on the right. The AI evidence integrates into the checklist side as a collapsible panel per question, between the question text and the answer columns.

```
+------------------------------------------------------------------+
| Q4. Did the review authors use a comprehensive literature        |
|     search strategy?                                             |
|                                                            [i]   |
+------------------------------------------------------------------+
| AI Evidence                                          [collapse]  |
|                                                                  |
| Sub-criteria coverage:                                           |
|                                                                  |
|   [found]  Searched at least 2 databases                         |
|            "We searched PubMed, Embase, CINAHL, and the          |
|             Cochrane Library"                          [view]    |
|                                                                  |
|   [found]  Provided search strategy                              |
|            "The full search strategy is provided in              |
|             Appendix 1"                                [view]    |
|                                                                  |
|   [found]  Justified publication restrictions                    |
|            "We included only English-language publications       |
|             due to resource constraints"                [view]    |
|                                                                  |
|   [found]  Searched reference lists                              |
|            "Reference lists of included studies were             |
|             hand-searched"                              [view]    |
|                                                                  |
|   [none]   Searched trial/study registries                       |
|            No mention found                                      |
|                                                                  |
|   [none]   Consulted content experts                             |
|            No mention found                                      |
|                                                                  |
|   [found]  Searched grey literature                              |
|            "Grey literature was searched using OpenGrey"  [view]  |
|                                                                  |
|   [found]  Search within 24 months of completion                 |
|            "Literature search was conducted in March 2023" [view] |
|                                                                  |
|  Suggested answer: Partial Yes                                   |
|  "Partial Yes criteria are met (2+ databases, search terms,      |
|   publication restrictions justified). For Yes, missing:         |
|   trial registry searching and expert consultation."             |
|                                                                  |
+------------------------------------------------------------------+
| For Partial Yes (all):        | For Yes, also:        | Answer  |
| [x] 2+ databases              | [x] reference lists    | ( ) Yes |
| [x] search terms              | [ ] trial registries   | (o) PY  |
| [x] justified restrictions    | [ ] experts            | ( ) No  |
|                                | [x] grey literature    |         |
|                                | [x] within 24 months   |         |
+------------------------------------------------------------------+
| Notes                                                [collapse]  |
+------------------------------------------------------------------+
```

**The [view] button** scrolls the PDF panel to the exact location of that passage and highlights it. This is possible because LangExtract provides character offsets, which can be mapped back to PDF page coordinates via PyMuPDF.

**The suggested answer** appears at the bottom of the evidence panel, after the reviewer has already seen the evidence. It is clearly labeled as a suggestion and shows its reasoning. The reviewer can agree, disagree, or ignore it.

**The sub-criteria indicators** ([found] / [none]) give the reviewer an immediate picture of evidence coverage without reading every passage. If a criterion shows [none], the reviewer knows to check the paper manually for that specific item.

### Evidence Coverage Dashboard

Before starting the checklist, the reviewer can see an overview of AI evidence coverage across all 16 questions:

```
+------------------------------------------------------------------+
| AI Evidence Coverage                                              |
|                                                                  |
| Q1  PICO            ████████████  Strong    Suggested: Yes       |
| Q2  Protocol        ██████░░░░░░  Partial   Suggested: PY       |
| Q3  Study designs   ████████████  Strong    Suggested: Yes       |
| Q4  Search          ████████░░░░  Partial   Suggested: PY       |
| Q5  Dup selection   ████████████  Strong    Suggested: Yes       |
| Q6  Dup extraction  ░░░░░░░░░░░░  None      Suggested: No       |
| Q7  Exclusions      ████████░░░░  Partial   Suggested: PY       |
| Q8  Descriptions    ████████████  Strong    Suggested: Yes       |
| Q9a RoB (RCTs)      ████████████  Strong    Suggested: Yes       |
| Q9b RoB (NRSI)      ░░░░░░░░░░░░  N/A       -                   |
| Q10 Funding         ░░░░░░░░░░░░  None      Suggested: No       |
| Q11 Meta-analysis   ████████████  Strong    Suggested: Yes       |
| Q12 RoB impact      ████████░░░░  Partial   Suggested: PY       |
| Q13 RoB discussion  ████████████  Strong    Suggested: Yes       |
| Q14 Heterogeneity   ████████████  Strong    Suggested: Yes       |
| Q15 Pub bias        ████████████  Strong    Suggested: Yes       |
| Q16 COI             ████████████  Strong    Suggested: Yes       |
|                                                                  |
| Overall: High confidence on 11/16 questions                      |
| Suggested AMSTAR2 rating: Moderate (1 critical flaw: Q7)        |
+------------------------------------------------------------------+
```

This dashboard is informational, not prescriptive. It tells the reviewer where to focus attention -- questions with "None" or "Partial" evidence likely need careful manual review. Questions with "Strong" evidence can be reviewed faster since the relevant passages are already surfaced.

### PDF Highlighting

When viewing a question's AI evidence, the PDF panel highlights all relevant passages for that question. Different extraction classes could use different highlight colors to distinguish between, say, search strategy details and database names.

Clicking a highlighted passage in the PDF could scroll the checklist to the corresponding evidence item, and vice versa. This bidirectional linking between checklist and PDF is the core navigation improvement -- the reviewer never has to manually hunt for relevant passages.

### Reconciliation with AI Context

The existing reconciliation UI shows Reviewer 1 and Reviewer 2 answers side-by-side with a "Requires Reconciliation" banner on disagreements. AI evidence adds a third dimension:

```
+------------------------------------------------------------------+
| Q4. Search strategy                    [Requires Reconciliation] |
+------------------------------------------------------------------+
| Reviewer 1          | Reviewer 2           | Reconciled          |
| Answer: Yes         | Answer: Partial Yes  | Answer: ___         |
|                     |                      |                     |
| Notes: "Grey lit    | Notes: "No evidence  | [Use R1] [Use R2]   |
|  searched via       |  of expert consult   |                     |
|  OpenGrey"          |  or trial registry   |                     |
|                     |  searching"          |                     |
+------------------------------------------------------------------+
| AI Evidence for this question:                                   |
|                                                                  |
| [found] Grey literature: "searched using OpenGrey"       [view]  |
| [none]  Trial registries: No mention found                       |
| [none]  Expert consultation: No mention found                    |
|                                                                  |
| Note: Reviewer 1 and Reviewer 2 agree on all sub-criteria       |
| except the final answer. Both acknowledge missing trial          |
| registry and expert consultation. The disagreement is about      |
| whether the remaining criteria are sufficient for "Yes."         |
+------------------------------------------------------------------+
```

The AI context helps the reconciler by:

- Showing the specific passages both reviewers would have seen
- Identifying what both reviewers agree on at the sub-criteria level
- Framing the disagreement in terms of the specific criterion that is in dispute
- Not taking a side -- just clarifying what the actual point of disagreement is

### Notes Integration

The existing per-question NoteEditor could be enhanced with a "Copy to notes" action on any AI evidence item. When a reviewer wants to record why they answered a certain way, they can pull in the relevant passage as a starting point. This saves manual transcription and ensures the note references specific text.

---

## Handling the AI Trust Problem

### The Hallucination Risk

There are two places hallucination can occur:

1. **Extraction layer (LangExtract)**: The model claims to extract a passage that does not exist, or misquotes text. LangExtract mitigates this through source grounding -- every extraction includes character offsets that can be verified against the original text. If the offsets do not match, the extraction is discarded.

2. **Reasoning layer (post-processing LLM)**: The model produces a justification that misinterprets the extracted passages, or claims a passage supports a criterion when it does not. This is harder to prevent because it involves interpretation, not just extraction.

**Mitigation strategy:**

- The reasoning LLM is constrained to reference only extracted passages (by ID). It cannot introduce new claims about the paper.
- Each claim in the evidence summary must cite a specific extracted passage. Claims without citations are flagged.
- The suggested answer is always accompanied by explicit reasoning that the reviewer can evaluate.
- The UI shows the actual passage text, not the LLM's paraphrase. Reviewers verify against the source, not against the AI's interpretation.

### The Anchoring Risk

If a reviewer sees "Suggested answer: Yes" before evaluating the evidence, they are more likely to answer "Yes" regardless of what the evidence actually shows. This is a well-documented cognitive bias.

**Mitigation strategy:**

- Evidence is shown first, suggestion last. The reviewer sees the passages and sub-criteria coverage before seeing the suggested answer.
- The suggested answer is in a collapsible section that defaults to collapsed. Reviewers must actively choose to see it.
- Alternatively, suggestions can be disabled entirely in project settings, showing only the extracted evidence. Teams with strict independence requirements can use evidence-only mode.

### The Over-Reliance Risk

If the AI consistently produces good results, reviewers may stop reading the paper and just verify AI outputs. This reduces appraisal quality because the AI may miss things.

**Mitigation strategy:**

- The evidence coverage indicator explicitly shows gaps ([none] items). These gaps are not failures -- they are prompts for manual review.
- The dashboard-level view shows overall confidence. Low-confidence questions require the same manual effort they always have.
- The system tracks how long reviewers spend per question. If time drops significantly after AI is enabled, this is flagged for quality monitoring.
- Ultimately, the dual-reviewer requirement with independent assessment and reconciliation remains the safeguard. AI assists each reviewer individually, but the two-reviewer structure catches individual errors whether they are human or AI-influenced.

---

## Building for the Future

### Progressive Autonomy

The architecture supports increasing AI involvement as models improve:

**Level 1 (current capability): Evidence retrieval.**
AI finds and surfaces relevant passages. Reviewer reads them and decides. No answer suggestion.

**Level 2 (near-term): Evidence retrieval + answer suggestion.**
AI finds passages and suggests an answer with justification. Reviewer evaluates both the evidence and the suggestion. This is what is described in the UI mockups above.

**Level 3 (future): AI as a third reviewer.**
The AI produces a complete independent checklist assessment. The two human reviewers also produce independent assessments. The reconciliation process then has three inputs instead of two. Disagreements between humans and AI are treated the same as disagreements between humans -- they require discussion and resolution.

This does not replace human reviewers. It adds a consistent third perspective that never gets tired, never forgets to check a criterion, and processes every paper with the same thoroughness. The reconciliation process ensures that AI errors are caught by human judgment, and human errors are caught by AI consistency.

**Level 4 (further future): AI-calibrated confidence routing.**
The AI assesses its own confidence per question. High-confidence questions go through a streamlined review (reviewer verifies rather than evaluates from scratch). Low-confidence questions get full manual review. This allocates human attention where it matters most.

The key design decision is that **the data model and UI components are the same at every level**. The evidence panel, the sub-criteria coverage, the passage linking, the reconciliation view -- all of these work whether the AI is doing Level 1 retrieval or Level 3 independent assessment. The only thing that changes is what the AI produces and how much the reviewer relies on it.

### Feedback Loop

Every interaction is a data point:

- Reviewer saw AI suggestion "Yes" but answered "No" -- why? The notes field captures the reasoning.
- Reviewer modified the suggested answer from "Partial Yes" to "Yes" -- they found evidence the AI missed, or they interpreted a passage differently.
- Two reviewers both disagreed with the AI -- strong signal that the extraction or reasoning was wrong.
- Two reviewers both agreed with the AI -- confirmation that the pipeline works for this type of question.

This data accumulates per checklist type, per question, per paper type. Over time it reveals:

- Which questions the AI handles well and which it struggles with
- Whether certain paper structures (e.g., reviews with supplementary appendices) are systematically harder
- Whether the extraction examples need revision

Even if this data is never used for model fine-tuning, it is valuable for understanding where AI assistance is trustworthy and where it is not.

### Model Flexibility

The pipeline architecture is model-agnostic at every stage:

- **Extraction**: LangExtract currently uses Gemini, but supports OpenAI and Ollama. If a better extraction model appears, swap it in.
- **Reasoning**: The post-processing step can use any LLM. Gemini, Claude, GPT -- whatever produces the best reasoning for checklist interpretation.
- **Local models**: For organizations that cannot send research data to external APIs, Ollama support means the entire pipeline can run on-premise. Quality will be lower with current local models, but this gap is closing.

The extraction schemas (few-shot examples) and the question-to-extraction mappings are the durable assets. These encode domain knowledge about what AMSTAR2 questions require and how methodological reporting looks in systematic reviews. They transfer across models.

---

## Value Proposition

**For individual reviewers:**

- Spend less time searching the paper for relevant passages
- Clearer picture of which criteria are met and which are not
- Reduced risk of missing a criterion that was reported but hard to find
- Notes are pre-populated with evidence, reducing transcription effort

**For review teams:**

- More consistent appraisals across reviewers (both saw the same AI evidence)
- Faster reconciliation (disagreements are framed in terms of specific passages)
- Quality monitoring through AI agreement tracking

**For the review as a whole:**

- Higher-quality appraisals through reduced human error (missed criteria, misremembered passages)
- Auditable trail of evidence supporting each answer
- Faster turnaround without sacrificing rigor

**What it does not do:**

- Replace the need for two independent reviewers
- Make judgments about study quality (that remains human)
- Guarantee completeness (reviewers must still check for gaps)
- Work without a valid API key and internet connection (unless using local models)
