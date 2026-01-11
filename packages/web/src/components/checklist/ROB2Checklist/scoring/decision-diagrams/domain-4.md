Domain 4: Risk of bias in measurement of the outcome
Signalling questions Elaboration Response options
4.1 Was the method of
measuring the outcome
inappropriate?

This question aims to identify methods of outcome measurement (data collection) that are unsuitable for
the outcome they are intended to evaluate. The question does not aim to assess whether the choice of
outcome being evaluated was sensible (e.g. because it is a surrogate or proxy for the main outcome of
interest). In most circumstances, for pre-specified outcomes, the answer to this question will be ‘No’ or
‘Probably no’.
Answer ‘Yes’ or ‘Probably yes’ if the method of measuring the outcome is inappropriate, for example
because:
(1) it is unlikely to be sensitive to plausible intervention effects (e.g. important ranges of outcome
values fall outside levels that are detectable using the measurement method); or
(2) the measurement instrument has been demonstrated to have poor validity.

Y/PY/PN/N/NI

4.2 Could measurement
or ascertainment of the
outcome have differed
between intervention
groups?

Comparable methods of outcome measurement (data collection) involve the same measurement
methods and thresholds, used at comparable time points. Differences between intervention groups may
arise because of ‘diagnostic detection bias’ in the context of passive collection of outcome data, or if an
intervention involves additional visits to a healthcare provider, leading to additional opportunities for
outcome events to be identified.

Y/PY/PN/N/NI

4.3 If N/PN/NI to 4.1 and
4.2: Were outcome
assessors aware of the
intervention received by
study participants?

Answer ‘No’ if outcome assessors were blinded to intervention status. For participant-reported
outcomes, the outcome assessor is the study participant.

NA/Y/PY/PN/N/NI

4.4 If Y/PY/NI to 4.3:
Could assessment of the
outcome have been
influenced by knowledge
of intervention received?

Knowledge of the assigned intervention could influence participant-reported outcomes (such as level of
pain), observer-reported outcomes involving some judgement, and intervention provider decision
outcomes. They are unlikely to influence observer-reported outcomes that do not involve judgement, for
example all-cause mortality.

NA/Y/PY/PN/N/NI

18

4.5 If Y/PY/NI to 4.4: Is it
likely that assessment of
the outcome was
influenced by knowledge
of intervention received?

This question distinguishes between situations in which (i) knowledge of intervention status could have
influenced outcome assessment but there is no reason to believe that it did (assessed as ‘Some
concerns’) from those in which (ii) knowledge of intervention status was likely to influence outcome
assessment (assessed as ‘High’). When there are strong levels of belief in either beneficial or harmful
effects of the intervention, it is more likely that the outcome was influenced by knowledge of the
intervention received. Examples may include patient-reported symptoms in trials of homeopathy, or
assessments of recovery of function by a physiotherapist who delivered the intervention.

NA/Y/PY/PN/N/NI

Risk-of-bias judgement See algorithm. Low / High / Some
concerns

Optional: What is the
predicted direction of
bias in measurement of
the outcome?

If the likely direction of bias can be predicted, it is helpful to state this. The direction might be
characterized either as being towards (or away from) the null, or as being in favour of one of the
interventions.

NA / Favours
experimental / Favours
comparator / Towards
null /Away from null /
Unpredictable

flowchart LR
Q41["4.1 Method of measuring the outcome inappropriate?"]
Q42["4.2 Measurement or ascertainment of outcome differ between groups?"]

    Q43a["4.3 Outcome assessors aware of intervention received?"]
    Q44a["4.4 Could assessment have been influenced by knowledge of intervention?"]
    Q45a["4.5 Likely that assessment was influenced by knowledge of intervention?"]

    Q43b["4.3 Outcome assessors aware of intervention received?"]
    Q44b["4.4 Could assessment have been influenced by knowledge of intervention?"]
    Q45b["4.5 Likely that assessment was influenced by knowledge of intervention?"]

    L["Low risk"]
    M["Some concerns"]
    H["High risk"]

    %% 4.1
    Q41 -- "N/PN/NI" --> Q42
    Q41 -- "Y/PY" --> H

    %% 4.2
    Q42 -- "N/PN" --> Q43a
    Q42 -- "NI" --> Q43b
    Q42 -- "Y/PY" --> H

    %% Branch A (from N/PN)
    Q43a -- "N/PN" --> L
    Q43a -- "Y/PY/NI" --> Q44a

    Q44a -- "N/PN" --> L
    Q44a -- "Y/PY/NI" --> Q45a

    Q45a -- "N/PN" --> M
    Q45a -- "Y/PY/NI" --> H

    %% Branch B (from NI)
    Q43b -- "N/PN" --> M
    Q43b -- "Y/PY/NI" --> Q44b

    Q44b -- "N/PN" --> M
    Q44b -- "Y/PY/NI" --> Q45b

    Q45b -- "N/PN" --> M
    Q45b -- "Y/PY/NI" --> H
