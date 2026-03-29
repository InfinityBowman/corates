Domain 3: Risk of bias due to missing outcome data
Signalling questions Elaboration Response options
3.1 Were data for this
outcome available for all,
or nearly all, participants
randomized?

The appropriate study population for an analysis of the intention to treat effect is all randomized
participants.
“Nearly all” should be interpreted as that the number of participants with missing outcome data is
sufficiently small that their outcomes, whatever they were, could have made no important difference to
the estimated effect of intervention.
For continuous outcomes, availability of data from 95% of the participants will often be sufficient. For
dichotomous outcomes, the proportion required is directly linked to the risk of the event. If the observed
number of events is much greater than the number of participants with missing outcome data, the bias
would necessarily be small.
Only answer ‘No information’ if the trial report provides no information about the extent of missing
outcome data. This situation will usually lead to a judgement that there is a high risk of bias due to missing
outcome data.
Note that imputed data should be regarded as missing data, and not considered as ‘outcome data’ in
the context of this question.

Y/PY/PN/N/NI

3.2 If N/PN/NI to 3.1: Is
there evidence that the
result was not biased by
missing outcome data?

Evidence that the result was not biased by missing outcome data may come from: (1) analysis methods
that correct for bias; or (2) sensitivity analyses showing that results are little changed under a range of
plausible assumptions about the relationship between missingness in the outcome and its true value.

However, imputing the outcome variable, either through methods such as ‘last-observation-carried-
forward’ or via multiple imputation based only on intervention group, should not be assumed to correct

for bias due to missing outcome data.

NA/Y/PY/PN/N

3.3 If N/PN to 3.2: Could
missingness in the
outcome depend on its
true value?

If loss to follow up, or withdrawal from the study, could be related to participants’ health status, then it
is possible that missingness in the outcome was influenced by its true value. However, if all missing
outcome data occurred for documented reasons that are unrelated to the outcome then the risk of bias
due to missing outcome data will be low (for example, failure of a measuring device or interruptions to
routine data collection).
In time-to-event analyses, participants censored during trial follow-up, for example because they
withdrew from the study, should be regarded as having missing outcome data, even though some of their
follow up is included in the analysis. Note that such participants may be shown as included in analyses in
CONSORT flow diagrams.

NA/Y/PY/PN/N/NI

15

3.4 If Y/PY/NI to 3.3: Is it
likely that missingness in
the outcome depended on
its true value?

This question distinguishes between situations in which (i) missingness in the outcome could depend on
its true value (assessed as ‘Some concerns’) from those in which (ii) it is likely that missingness in the
outcome depended on its true value (assessed as ‘High risk of bias’). Five reasons for answering ‘Yes’ are:

1. Differences between intervention groups in the proportions of missing outcome data. If there is a
   difference between the effects of the experimental and comparator interventions on the outcome,
   and the missingness in the outcome is influenced by its true value, then the proportions of missing
   outcome data are likely to differ between intervention groups. Such a difference suggests a risk of
   bias due to missing outcome data, because the trial result will be sensitive to missingness in the
   outcome being related to its true value. For time-to-event-data, the analogue is that rates of
   censoring (loss to follow-up) differ between the intervention groups.
2. Reported reasons for missing outcome data provide evidence that missingness in the outcome
   depends on its true value;
3. Reported reasons for missing outcome data differ between the intervention groups;
4. The circumstances of the trial make it likely that missingness in the outcome depends on its true
   value. For example, in trials of interventions to treat schizophrenia it is widely understood that
   continuing symptoms make drop out more likely.
5. In time-to-event analyses, participants’ follow up is censored when they stop or change their
   assigned intervention, for example because of drug toxicity or, in cancer trials, when participants
   switch to second-line chemotherapy.
   Answer ‘No’ if the analysis accounted for participant characteristics that are likely to explain the
   relationship between missingness in the outcome and its true value.

NA/Y/PY/PN/N/NI

Risk-of-bias judgement See algorithm. Low / High / Some
concerns

Optional: What is the
predicted direction of bias
due to missing outcome
data?

If the likely direction of bias can be predicted, it is helpful to state this. The direction might be
characterized either as being towards (or away from) the null, or as being in favour of one of the
interventions.

NA / Favours
experimental / Favours
comparator / Towards
null /Away from null /
Unpredictable

flowchart LR
Q31["3.1 Outcome data for all participants?"]
Q32["3.2 Evidence that result is not biased?"]
Q33["3.3 Missingness could depend on true value?"]
Q34["3.4 Likely that missingness depended on true value?"]

    L["Low risk"]
    M["Some concerns"]
    H["High risk"]

    %% Question 3.1
    Q31 -- "Y/PY" --> L
    Q31 -- "N/PN/NI" --> Q32

    %% Question 3.2
    Q32 -- "Y/PY" --> L
    Q32 -- "N/PN" --> Q33

    %% Question 3.3
    Q33 -- "N/PN" --> L
    Q33 -- "Y/PY/NI" --> Q34

    %% Question 3.4
    Q34 -- "N/PN" --> M
    Q34 -- "Y/PY/NI" --> H
