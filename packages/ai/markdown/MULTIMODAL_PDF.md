# Multimodal PDF Processing

## The Problem with Text Extraction

PyMuPDF extracts text from PDFs by reading the text layer. This works well for body paragraphs but fails in predictable ways:

**Tables lose their structure.** A characteristics-of-included-studies table with columns for Author, Year, Design, N, Intervention, Comparator, and Outcome becomes a jumbled sequence of cell values with no clear column association. The text "Smith 2019 RCT 120 CBT Waitlist Depression" could be one row, or it could be fragments from multiple rows that happened to be adjacent in the PDF layout.

**Figures are invisible.** Forest plots, funnel plots, PRISMA flow diagrams, and risk of bias summary figures carry critical information that text extraction cannot access at all. A forest plot encodes effect sizes, confidence intervals, weights, and heterogeneity statistics visually. A PRISMA flow diagram shows the exact numbers at each screening stage.

**Multi-column layouts scramble reading order.** Many journals use two-column layouts. PyMuPDF sometimes interleaves text from left and right columns, producing sentences that jump between unrelated paragraphs.

**Formatting signals are lost.** Bold headers, italic emphasis, superscript references, and indentation all carry meaning. Text extraction flattens these into plain strings.

## What Multimodal Models Can Do

Gemini 2.5 Flash and Pro can accept images as input alongside text prompts. A PDF page rendered as an image preserves all visual information -- tables, figures, layout, formatting -- exactly as a human reader would see it.

When given an image of a table, Gemini can:

- Identify column headers and row labels
- Extract cell values with correct column associations
- Handle merged cells, spanning headers, and nested tables
- Recognize footnotes and annotations attached to specific cells

When given an image of a forest plot, Gemini can:

- Read study labels, effect sizes, and confidence intervals
- Identify the pooled estimate and its confidence interval
- Read heterogeneity statistics (I-squared, Q, p-value)
- Distinguish subgroup analyses from overall results

When given an image of a PRISMA flow diagram, Gemini can:

- Extract counts at each stage (identified, screened, assessed, included)
- Read exclusion reasons and their counts
- Understand the flow direction and branching logic

This is not theoretical. Current multimodal models handle these tasks with reasonable accuracy. The quality will only improve.

## Architecture

### Hybrid Approach

Processing every page as an image is wasteful. Body text pages are handled well by text extraction and do not need multimodal processing. The efficient approach is:

1. **Extract text from all pages** using PyMuPDF (fast, cheap)
2. **Detect pages with tables or figures** using layout analysis
3. **Render those pages as images** and process them with the vision model
4. **Merge results** -- text extraction for body content, multimodal extraction for tables and figures

### Page Classification

PyMuPDF provides layout information beyond just text. It can detect:

- **Image blocks** on a page (figures, charts, diagrams)
- **Table structures** through line detection and cell boundaries
- **Drawing objects** (lines, rectangles) that often indicate tables or figures

A simple classifier:

- If a page contains image blocks larger than a threshold, mark it for multimodal processing
- If a page contains a grid of horizontal and vertical lines (table indicators), mark it for multimodal processing
- Otherwise, use text extraction only

This reduces the number of multimodal API calls to typically 3-8 pages per paper (the pages with tables and figures) rather than all 10-20 pages.

### Multimodal Extraction

For pages identified as containing tables or figures, render the page as an image and send it to Gemini with a structured prompt:

**For tables:**

> "Extract the complete table from this image. Return it as structured JSON with column headers and row data. Preserve all cell values exactly as written, including footnote markers. If the table spans multiple columns or has merged headers, represent the hierarchy."

**For figures:**

> "Describe this figure from a research paper. If it is a forest plot, extract each study's name, effect size, confidence interval, and weight. If it is a funnel plot, describe the distribution pattern. If it is a flow diagram, extract the counts at each stage. If it is another type of figure, describe its content and key findings."

The structured output from table extraction can then be processed by the same downstream pipeline as text -- the LLM reasoning step can interpret table data against checklist criteria just as it interprets text passages.

### Integration with the Extraction Pipeline

The full pipeline becomes:

```
PDF
 |
 +---> PyMuPDF text extraction (all pages)
 |        |
 |        +---> Strip references
 |        +---> Section classification
 |        +---> Body text for LangExtract
 |
 +---> PyMuPDF layout analysis (all pages)
 |        |
 |        +---> Identify table/figure pages
 |
 +---> Render table/figure pages as images
          |
          +---> Gemini multimodal extraction
          |        |
          |        +---> Structured table data (JSON)
          |        +---> Figure descriptions
          |
          +---> Merge with text extraction results
                   |
                   +---> Combined input for LangExtract / LLM reasoning
```

## What This Unlocks for AMSTAR2

Several AMSTAR2 questions benefit directly from table and figure extraction:

**Q8 (Study descriptions):** The "characteristics of included studies" table is where most of this information lives. Text extraction produces garbled output from this table. Multimodal extraction preserves the column structure, making it possible to verify that population, intervention, comparator, outcomes, design, and setting are all described.

**Q9 (RoB assessment):** Risk of bias summary tables (the traffic-light tables) show which tool was used and how each study scored across bias domains. Extracting this structured data confirms what RoB tool was used and whether all relevant domains were assessed.

**Q11 (Meta-analysis methods):** Forest plots contain the statistical results that Q11 asks about. Extracting effect sizes, heterogeneity statistics, and weighting from the forest plot provides direct evidence of the statistical methods used.

**Q12 (RoB impact):** Sensitivity analysis forest plots (with and without high-RoB studies) are often presented as figures. Multimodal extraction can compare pooled estimates across these analyses.

**Q14 (Heterogeneity):** Subgroup analysis forest plots show how heterogeneity was investigated. Extracting subgroup labels and their effect estimates provides evidence for Q14.

**Q15 (Publication bias):** Funnel plots are the standard visualization. A multimodal model can assess funnel plot symmetry and read Egger's test results from the figure caption.

## What This Unlocks for ROB2 and ROBINS-I

**Baseline characteristic tables:** ROB2 Domain 1 asks about baseline differences between groups. The baseline characteristics table (Table 1 in most RCTs) contains this data. Multimodal extraction preserves the group-by-variable structure.

**CONSORT flow diagrams:** These show participant flow through the trial -- enrollment, allocation, follow-up, analysis. ROB2 Domain 3 (missing outcome data) and Domain 2 (deviations from intended interventions) both benefit from these counts.

**Outcome tables:** Effect estimates, confidence intervals, and p-values are often in results tables. Extracting these with correct column associations is critical for the preliminary section of ROB2 (specifying the numerical result being assessed).

## Cost Considerations

Multimodal API calls are more expensive than text-only calls. With Gemini 2.5 Flash:

- Text input: priced per token (cheap for ~30k chars of text)
- Image input: priced per image, roughly equivalent to ~250 tokens per image

For a typical paper with 5 table/figure pages, the multimodal processing adds roughly the cost of 1,250 extra tokens per paper. This is small relative to the text extraction cost and well worth the improvement in data quality.

The hybrid approach (text for body, images for tables/figures) keeps costs low by only using multimodal processing where it adds value.

## Implementation Path

### Step 1: Page classification

Add layout analysis to the pre-processing step. Use PyMuPDF's block-level information to detect pages with tables and figures. Output a list of page numbers that need multimodal processing.

### Step 2: Page rendering

Render flagged pages as PNG images using PyMuPDF's `page.get_pixmap()`. Choose a resolution that balances image quality with API cost (150-200 DPI is typically sufficient for table text to be readable).

### Step 3: Table extraction

Send table page images to Gemini with a structured extraction prompt. Parse the JSON response into a normalized table format (list of rows with named columns).

### Step 4: Figure extraction

Send figure page images to Gemini with a figure description prompt. Store the structured output (forest plot data, flow diagram counts, etc.) alongside the text extraction results.

### Step 5: Merge and downstream

Combine text extraction and multimodal extraction into a single document representation. Pass this to the LangExtract / LLM reasoning pipeline. The downstream steps do not need to know whether a piece of evidence came from text or image extraction.

## Limitations

**Scanned PDFs.** Some older papers are scanned images with no text layer. These would require multimodal processing for every page, not just tables and figures. This works but is more expensive and slower.

**Supplementary files.** Many reviews put detailed tables (e.g., full search strategies, complete RoB assessments) in supplementary PDFs. These would need to be uploaded and processed separately. The pipeline supports this -- it just means processing multiple PDFs per study.

**Complex or unusual layouts.** Non-standard table designs, nested figures, or creative page layouts may not be handled well. The hybrid approach provides a fallback -- if multimodal extraction fails for a page, the text extraction is still available.

**Model accuracy on dense tables.** Very large tables (20+ rows, 8+ columns) with small text can challenge current models. Accuracy improves with higher resolution images, at the cost of more tokens. Future models will handle these better.
