The Risk Of Bias In Non-randomized Studies – of Interventions, Version 2 (ROBINS-I V2)

Assessment tool for follow-up studies
Date: 20 November 2025

⸻

This work is licensed under a Creative Commons Attribution–NonCommercial–NoDerivatives 4.0 International License.

⸻

Overview

The ROBINS-I V2 tool is used to assess risk of bias in non-randomized studies of interventions. This document is structured so it can be referenced directly by an implementation agent (e.g. form generation, validation logic, or scoring workflows).

⸻

At Planning Stage: Confounding Factors

P1. Important Confounding Factors

List the important confounding factors relevant to all or most studies on this topic. Specify whether these are particular to specific intervention–outcome combinations.

⸻

Per-Study Result Assessment

For each study result, complete sections A–D.

⸻

A. Specify the Result Being Assessed

A1. Numerical Result

Specify the numerical result being assessed.

A2. Further Details (optional)

Provide additional details (e.g. location in report, rationale for choosing this result).

A3. Outcome

Specify the outcome to which this result relates.

⸻

B. Decide Whether to Proceed With Risk-of-Bias Assessment

Question Response Options Comments
B1 Did the authors attempt to control for confounding? Y / PY / PN / N
B2 If N/PN to B1: Is there sufficient potential for confounding that this result should not be considered further? Y / PY / PN / N
B3 Was the method of measuring the outcome inappropriate? Y / PY / PN / N

Decision rule:
If B2 or B3 is Yes or Probably yes, classify the result as Critical risk of bias and stop further assessment.

⸻

C. Specify the Target Randomized Trial

The target randomized trial may be explicit or implied by the study design.

C1. Participants and Eligibility Criteria

C2. Intervention Strategy

C3. Comparator Strategy

C4. Handling of Protocol Deviations

Did the analysis account for switches or deviations during follow-up?
• ⬜ No — estimating the intention-to-treat effect
• ⬜ Yes — estimating the per-protocol effect

⸻

D. Information Sources

Select all sources used to inform the risk-of-bias judgement:
• Journal article(s)
• Study protocol
• Statistical analysis plan (SAP)
• Non-commercial registry record (e.g. ClinicalTrials.gov)
• Company-owned registry record
• Grey literature (e.g. unpublished thesis)
• Conference abstract(s)
• Regulatory document (e.g. CSR, approval package)
• Individual participant data
• Research ethics application
• Grant database summary (e.g. NIH RePORTER)
• Personal communication with investigator
• Personal communication with sponsor
• Other (specify):

⸻

Risk-of-Bias Assessment

Evaluation of Confounding Factors

Complete one row per confounding factor.

(i) Important Confounding Factors Listed in Advance

Confounding Factor Measured Variable(s) Controlled? (Y/N) Measured Validly & Reliably?\* (NA/Y/PY/PN/N/NI) If Not Controlled, Evidence Control Unnecessary?\*\* (NA/Y/PY/PN/N) Expected Bias Direction (optional) Comments

(ii) Additional Confounding Factors Identified in This Study

Confounding Factor Measured Variable(s) Controlled? (Y/N) Measured Validly & Reliably?\* (NA/Y/PY/PN/N/NI) If Not Controlled, Evidence Control Unnecessary?\*\* (NA/Y/PY/PN/N) Expected Bias Direction (optional) Comments

- Validity = accuracy of measurement; Reliability = precision of measurement.
  \*\* Control may be unnecessary due to study design, lack of association, minimal impact, negative controls, or external evidence.

⸻

Signalling Questions and Risk-of-Bias Judgements

Domain 1: Bias Due to Confounding

Variant A — Intention-to-Treat Effect (C4 = No)

Question Response Options Comments
1.1 Control for all important confounders? Y / PY / WN / SN / NI
1.2 Valid & reliable measurement of controlled confounders? NA / Y / PY / WN / SN / NI
1.3 Controlled for post-intervention variables? NA / Y / PY / PN / N / NI
1.4 Evidence of serious uncontrolled confounding? Y / PY / PN / N

Risk of bias judgement: Low / Moderate / Serious / Critical
Predicted direction of bias (optional): Upward / Downward / Unpredictable

⸻

Variant B — Per-Protocol Effect (C4 = Yes)

Question Response Options Comments
1.1 Appropriate method for time-varying confounding? Y / PY / PN / N / NI
1.2 Controlled all important baseline & time-varying confounders? NA / Y / PY / WN / SN / NI
1.3 Valid & reliable measurement? NA / Y / PY / WN / SN / NI
1.4 Controlled post-intervention variables? NA / Y / PY / PN / N / NI
1.5 Evidence of serious uncontrolled confounding? Y / PY / PN / N

Risk of bias judgement: Low / Moderate / Serious / Critical
Predicted direction of bias (optional): Upward / Downward / Unpredictable

⸻

Domain 2: Bias in Classification of Interventions

Question Response Options Comments
2.1 Distinguishable strategies at follow-up start? Y / PY / PN / N / NI
2.2 Outcomes occurred after strategies distinguishable? NA / Y / PY / PN / N / NI
2.3 Analysis avoided classification problems? NA / SY / WY / PN / N / NI
2.4 Classification influenced by outcome knowledge? SY / WY / PN / N / NI
2.5 Other classification errors likely? Y / PY / PN / N / NI

Risk of bias judgement: Low / Moderate / Serious / Critical
Predicted direction of bias: Favours intervention / Favours comparator / Towards null / Away from null / Unpredictable

⸻

Domain 3: Bias in Selection of Participants

A. Prevalent User Bias / Immortal Time

Question Response Options Comments
3.1 Follow-up began at intervention start? Y / PY / WN / SN / NI
3.2 Early outcome events excluded? Y / PY / PN / N / NI

B. Other Selection Bias

Question Response Options Comments
3.3 Selection based on post-intervention characteristics? Y / PY / PN / N / NI
3.4 Associated with intervention? NA / Y / PY / PN / N / NI
3.5 Influenced by outcome or cause of outcome? NA / Y / PY / PN / N / NI

C. Analysis & Severity

Question Response Options Comments
3.6 Analysis corrected selection bias? NA / Y / PY / PN / N / NI
3.7 Sensitivity analyses showed minimal impact? NA / Y / PY / PN / N / NI
3.8 Bias too severe for quantitative synthesis? NA / Y / PY / PN / N / NI

Risk of bias judgement: Low / Moderate / Serious / Critical

⸻

Domain 4: Bias Due to Missing Data

Question Response Options Comments
4.1 Complete intervention data? Y / PY / PN / N / NI
4.2 Complete outcome data? Y / PY / PN / N / NI
4.3 Complete confounder data? Y / PY / PN / N / NI
4.4 Complete case analysis used? NA / Y / PY / PN / N / NI
4.5 Missingness related to outcome? NA / Y / PY / PN / N / NI
4.6 Explained by model variables? NA / Y / PY / WN / SN / NI
4.7 Imputation used? NA / Y / PY / PN / NI
4.8 MAR/MCAR assumption reasonable? NA / Y / PY / PN / N / NI
4.9 Imputation appropriate? NA / Y / PY / WN / SN / NI
4.10 Alternative correction used? NA / Y / PY / WN / SN / NI
4.11 Evidence result not biased? NA / Y / PY / PN / N

Risk of bias judgement: Low / Moderate / Serious / Critical

⸻

Domain 5: Bias in Measurement of the Outcome

Question Response Options Comments
5.1 Outcome measurement differed by group? Y / PY / PN / N / NI
5.2 Assessors aware of intervention? Y / PY / PN / N / NI
5.3 Assessment influenced by awareness? NA / SY / WY / PN / N / NI

Risk of bias judgement: Low / Moderate / Serious / Critical

⸻

Domain 6: Bias in Selection of the Reported Result

Question Response Options Comments
6.1 Reported per pre-specified plan? Y / PY / PN / N / NI
6.2 Selected from multiple outcome measures? Y / PY / PN / N / NI
6.3 Selected from multiple analyses? Y / PY / PN / N / NI
6.4 Selected from multiple subgroups? Y / PY / PN / N / NI

Risk of bias judgement: Low / Moderate / Serious / Critical

⸻

Overall Risk of Bias

Item Response Options
Overall risk of bias Low (except confounding) / Moderate / Serious / Critical
Predicted direction of bias Upward / Downward / Favours intervention / Favours comparator / Towards null / Away from null / Unpredictable

⸻

This work is licensed under a Creative Commons Attribution–NonCommercial–NoDerivatives 4.0 International License.
