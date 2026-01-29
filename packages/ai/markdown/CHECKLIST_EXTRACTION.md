# Checklist-Aware Extraction: Making AI Useful for CoRATES Appraisals

## The Problem with Generic Extraction

The current extraction experiment pulls generic study metadata: title, authors, study design, sample size, population, outcomes. This is a reasonable starting point, but it does not map to what reviewers actually need when filling out AMSTAR2, ROB2, or ROBINS-I checklists.

A reviewer sitting in front of an AMSTAR2 form is not asking "what is the sample size?" They are asking specific methodological questions like "did the authors report searching trial registries?" or "was allocation sequence concealment described?" The AI needs to extract passages that answer _these_ questions, not just basic bibliographic metadata.

## What Each Checklist Actually Needs

### AMSTAR2 (Systematic Reviews)

AMSTAR2 appraises _systematic reviews_, not primary studies. The 16 questions ask about the review's methodology, not its clinical findings. Here is what a checklist-aware extraction would target for each question:

| Question                    | What to Extract from the Review                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Q1 (PICO)                   | Passages stating population, intervention, comparator, outcome, and timeframe                                   |
| Q2 (Protocol)               | Mentions of PROSPERO registration, protocol publication, pre-specified methods                                  |
| Q3 (Study designs)          | Justification for including RCTs only, NRSI only, or both                                                       |
| Q4 (Search strategy)        | Database names, search terms, date restrictions, grey literature, reference list searching, expert consultation |
| Q5 (Duplicate selection)    | Statements about independent screening by 2+ reviewers, kappa statistics, consensus process                     |
| Q6 (Duplicate extraction)   | Statements about independent data extraction by 2+ reviewers                                                    |
| Q7 (Excluded studies)       | Whether a list of excluded studies is provided with justifications                                              |
| Q8 (Study descriptions)     | Level of detail for populations, interventions, comparators, outcomes, settings, timeframes                     |
| Q9 (RoB assessment)         | Which RoB tool was used (Cochrane, Newcastle-Ottawa, etc.), what bias domains were assessed                     |
| Q10 (Funding)               | Whether funding sources of included studies are reported                                                        |
| Q11 (Meta-analysis)         | Statistical methods, heterogeneity assessment (I-squared, Q-test), weighting technique, subgroup analyses       |
| Q12 (RoB impact)            | Sensitivity analyses excluding high-RoB studies, discussion of RoB influence on pooled estimates                |
| Q13 (RoB discussion)        | Discussion of how RoB findings affect interpretation of results                                                 |
| Q14 (Heterogeneity)         | Exploration of heterogeneity sources (subgroup analysis, meta-regression, narrative)                            |
| Q15 (Publication bias)      | Funnel plots, Egger's test, trim-and-fill, other publication bias assessments                                   |
| Q16 (Conflicts of interest) | Author COI disclosures, funder involvement in the review                                                        |

This is fundamentally different from "extract the study title and sample size." Each question requires finding specific methodological passages scattered throughout the paper.

### ROB2 (Randomized Controlled Trials)

ROB2 appraises individual RCTs across 5 bias domains. The extraction targets are:

**Domain 1 - Randomization process:**

- How was the random sequence generated? (computer, table, coin toss)
- How was allocation concealed? (central, sealed envelopes, pharmacy-controlled)
- Were there baseline imbalances between groups?

**Domain 2 - Deviations from intended interventions:**

- Were participants blinded?
- Were care providers blinded?
- Were there protocol deviations due to the trial context?
- Was an ITT analysis used?

**Domain 3 - Missing outcome data:**

- What proportion of data is missing?
- Is missingness related to the outcome?
- Were sensitivity analyses performed for missing data?

**Domain 4 - Outcome measurement:**

- Was the outcome assessor blinded?
- Could knowledge of intervention influence assessment?
- Were outcome measurement methods comparable across groups?

**Domain 5 - Selection of reported result:**

- Was there a pre-registered protocol or SAP?
- Were multiple outcome measurements possible?
- Were multiple analyses possible?

**Preliminary fields:**

- Study design (parallel, cluster, crossover)
- Experimental intervention description
- Comparator description
- Specific numerical result being assessed

### ROBINS-I (Non-Randomized Studies)

ROBINS-I is the most complex, with planning sections and 6 bias domains. Key extraction targets include:

- Confounding variables considered and how they were controlled
- How the intervention was defined and classified
- Selection processes and timing
- Completeness of follow-up and missing data handling
- Outcome measurement methods and blinding
- Whether results were selected from multiple analyses

## How to Structure Checklist-Aware Extraction

### Approach 1: One Extraction Schema Per Checklist Question

Create separate LangExtract few-shot examples for each checklist question. For AMSTAR2 Q4 (search strategy), the extraction would look for:

```
extraction_class: "search_databases"
extraction_text: "We searched PubMed, Embase, CINAHL, and PsycINFO"

extraction_class: "search_dates"
extraction_text: "from inception to March 2023"

extraction_class: "grey_literature"
extraction_text: "Grey literature was searched using OpenGrey and conference proceedings"

extraction_class: "reference_checking"
extraction_text: "Reference lists of included studies were hand-searched"
```

**Advantages:**

- High precision for each question
- Extracted passages map directly to checklist sub-items
- Reviewers see exactly the evidence for each criterion

**Disadvantages:**

- Requires running extraction N times per paper (once per question), which multiplies API costs and time
- Many separate extraction schemas to maintain

### Approach 2: Domain-Level Extraction

Group related questions into extraction domains and extract all relevant passages at once. For example, a "methodology reporting" domain for AMSTAR2 could cover Q1-Q6 in a single pass.

**Advantages:**

- Fewer extraction passes (3-4 per paper instead of 16)
- Lower cost and latency

**Disadvantages:**

- Less precise mapping to individual sub-items
- Examples are harder to write because the extraction classes are broader

### Approach 3: Full-Paper Extraction with Post-Processing (recommended to start)

Run a single extraction pass per checklist type that looks for all methodological indicators at once. Use a checklist-specific prompt and examples that cover the key evidence types across all questions. Then post-process the results to group extracted passages by question.

For AMSTAR2, the prompt would be something like:

> "Extract methodological reporting elements from this systematic review. Identify passages related to: PICO specification, protocol registration, study design justification, search strategy details, reviewer independence, excluded studies, study descriptions, risk of bias assessment methods, funding source reporting, statistical methods, heterogeneity investigation, publication bias assessment, and conflict of interest disclosures."

The extraction classes would be things like `protocol_registration`, `search_database`, `reviewer_independence`, `rob_tool_used`, `heterogeneity_method`, `publication_bias_method`, etc.

After extraction, a mapping layer assigns each extracted passage to the relevant checklist questions.

**Advantages:**

- Single pass per paper per checklist type
- Still maps to individual questions via post-processing
- Reasonable cost and latency

**Disadvantages:**

- One-pass extraction may miss some items that a targeted per-question pass would catch
- The mapping layer adds complexity

## What the Reviewer Experience Could Look Like

When a reviewer opens a checklist question in CoRATES, they would see:

1. The question text and guidance (already exists)
2. **A panel of extracted passages** relevant to this question, each with:
   - The verbatim text from the paper
   - The page/location in the PDF where it appears (LangExtract provides source grounding)
   - The extraction class label
3. The reviewer reads the passages, decides the answer, and fills in the checklist

This does not automate the judgment -- reviewers still decide "Yes," "Partial Yes," or "No." But it eliminates the time spent hunting through the PDF for the right paragraphs.

### For Reconciliation

When two reviewers disagree on a question, the system could show:

- The passages both reviewers would have seen
- Any passages that are ambiguous or could support either answer
- This grounds the reconciliation discussion in specific text rather than memory

## Practical Next Steps

### Step 1: Build AMSTAR2 extraction schemas

AMSTAR2 is a good starting point because:

- It appraises systematic reviews, which have predictable structure (background, methods, results, discussion)
- The 16 questions are well-defined with explicit sub-criteria
- Methodological reporting elements are relatively easy to locate in text

Create few-shot examples for each extraction class using real systematic review papers. Start with Approach 3 (single pass with post-processing) and evaluate whether recall is acceptable.

### Step 2: Build a question-to-extraction mapping

Define which extraction classes are relevant to each AMSTAR2 question. For example:

- Q4 maps to `search_database`, `search_terms`, `search_dates`, `grey_literature`, `reference_checking`, `expert_consultation`
- Q2 maps to `protocol_registration`, `protocol_publication`, `methods_prespecified`

### Step 3: Evaluate against human reviewers

Run extraction on papers that have already been appraised by human reviewers. Compare:

- Did the AI find the same passages humans relied on?
- Did it miss any critical passages?
- Did it surface passages that humans missed?

### Step 4: Extend to ROB2 and ROBINS-I

ROB2 and ROBINS-I appraise individual studies rather than reviews. The extraction targets are different (randomization methods, blinding, confounding control) but the approach is the same.

## Cost and Latency Considerations

With Gemini 2.5 Flash:

- A 30-40k character paper takes about 1-2 minutes with parallel processing
- Cost is low (Flash is the cheapest Gemini model)
- Running one extraction per checklist type means 1 pass per paper per checklist

For a project with 20 included studies and AMSTAR2 appraisal, that is 20 extraction runs. With ROB2 as well, that is 40 runs. This is manageable.

For larger reviews (100+ studies), batch processing with progress tracking would be needed.

## What This Does Not Replace

- **Reviewer judgment**: AI surfaces passages, humans decide answers
- **Full-text reading**: Reviewers should still read the paper; extraction helps them navigate, not skip
- **Methodological expertise**: Understanding what "allocation concealment" means or why "ITT analysis" matters requires domain knowledge the AI does not provide
- **Reconciliation discussion**: The AI can surface relevant passages, but the conversation between reviewers about how to interpret ambiguous evidence is inherently human

## Open Questions

1. **How to handle tables and figures?** PyMuPDF extracts text but may not preserve table structure well. Forest plots, funnel plots, and flow diagrams carry information that text extraction misses.

2. **Supplementary materials?** Many reviews provide detailed search strategies, excluded study lists, or RoB tables in supplementary files. These are separate PDFs/documents.

3. **How confident do we need to be?** If the AI misses a relevant passage, the reviewer may answer "No" when the correct answer is "Yes." High recall matters more than high precision -- surfacing an irrelevant passage wastes a few seconds of reading, but missing a relevant passage could lead to an incorrect appraisal.

4. **Should the AI suggest answers?** Going beyond passage extraction to suggest "this looks like a Yes for Q4" adds value but also risk. A wrong suggestion could anchor the reviewer. Starting with passage extraction only is safer.

5. **Per-study vs per-review extraction?** AMSTAR2 applies to the review as a whole. ROB2 and ROBINS-I apply to each included study individually. The extraction pipeline needs to handle both cases.
