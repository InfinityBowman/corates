Domain 2: Risk of bias due to deviations from the intended interventions (effect of adhering to intervention)
Signalling questions Elaboration Response options
2.1. Were participants
aware of their assigned
intervention during the
trial?

If participants are aware of their assigned intervention it is more likely that health-related behaviours will
differ between the intervention groups. Blinding participants, most commonly through use of a placebo
or sham intervention, may prevent such differences. If participants experienced side effects or toxicities
that they knew to be specific to one of the interventions, answer this question ‘Yes’ or ‘Probably yes’.

Y/PY/PN/N/NI

2.2. Were carers and
people delivering the
interventions aware of
participants' assigned
intervention during the
trial?

If carers or people delivering the interventions are aware of the assigned intervention then its
implementation, or administration of non-protocol interventions, may differ between the intervention
groups. Blinding may prevent such differences. If participants experienced side effects or toxicities that
carers or people delivering the interventions knew to be specific to one of the interventions, answer ‘Yes’
or ‘Probably yes’. If randomized allocation was not concealed, then it is likely that carers and people
delivering the interventions were aware of participants' assigned intervention during the trial.

Y/PY/PN/N/NI

2.3. [If applicable:] If
Y/PY/NI to 2.1 or 2.2:

Were important non-
protocol interventions

balanced across
intervention groups?

This question is asked only if the preliminary considerations specify that the assessment will address

imbalance of important non-protocol interventions between intervention groups. Important non-
protocol interventions are the additional interventions or exposures that: (1) are inconsistent with the

trial protocol; (2) trial participants might receive with or after starting their assigned intervention; and (3)
are prognostic for the outcome. Risk of bias will be higher if there is imbalance in such interventions
between the intervention groups.

NA/Y/PY/PN/N/NI

2.4. [If applicable:] Were
there failures in
implementing the
intervention that could
have affected the
outcome?

This question is asked only if the preliminary considerations specify that the assessment will address
failures in implementing the intervention that could have affected the outcome. Risk of bias will be
higher if the intervention was not implemented as intended by, for example, the health care
professionals delivering care. Answer ‘No’ or ‘Probably no’ if implementation of the intervention was
successful for most participants.

NA/Y/PY/PN/N/NI

2.5. [If applicable:] Was
there non-adherence to
the assigned intervention
regimen that could have
affected participants’
outcomes?

This question is asked only if the preliminary considerations specify that the assessment will address non-
adherence that could have affected participants’ outcomes. Non-adherence includes imperfect

compliance with a sustained intervention, cessation of intervention, crossovers to the comparator
intervention and switches to another active intervention. Consider available information on the
proportion of study participants who continued with their assigned intervention throughout follow up,
and answer ‘Yes’ or ‘Probably yes’ if the proportion who did not adhere is high enough to raise concerns.
Answer ‘No’ for studies of interventions that are administered once, so that imperfect adherence is not
possible, and all or most participants received the assigned intervention.

NA/Y/PY/PN/N/NI

12

2.6. If N/PN/NI to 2.3, or
Y/PY/NI to 2.4 or 2.5:
Was an appropriate
analysis used to estimate
the effect of adhering to
the intervention?

Both ‘ naïve ‘per-protocol’ analyses (excluding trial participants who did not receive their allocated
intervention) and ‘as treated’ analyses (comparing trial participants according to the intervention they
actually received) will usually be inappropriate for estimating the effect of adhering to intervention (the
‘per-protocol’ effect). However, it is possible to use data from a randomized trial to derive an unbiased
estimate of the effect of adhering to intervention. Examples of appropriate methods include: (1)
instrumental variable analyses to estimate the effect of receiving the assigned intervention in trials in
which a single intervention, administered only at baseline and with all-or-nothing adherence, is compared
with standard care; and (2) inverse probability weighting to adjust for censoring of participants who cease
adherence to their assigned intervention, in trials of sustained treatment strategies. These methods
depend on strong assumptions, which should be appropriate and justified if the answer to this question is
‘Yes’ or ‘Probably yes’. It is possible that a paper reports an analysis based on such methods without
reporting information on the deviations from intended intervention, but it would be hard to judge such an
analysis to be appropriate in the absence of such information.
If an important non-protocol intervention was administered to all participants in one intervention group,
adjustments cannot be made to overcome this.
Some examples of analysis strategies that would not be appropriate to estimate the effect of adhering to
intervention are (i) ‘Intention to treat (ITT) analysis’, (ii) ‘per protocol analysis’, (iii) ‘as-treated analysis’,
(iv) ‘analysis by treatment received’.

NA/Y/PY/PN/N/NI

Risk-of-bias judgement See algorithm. Low / High / Some
concerns

Optional: What is the
predicted direction of
bias due to deviations
from intended
interventions?

If the likely direction of bias can be predicted, it is helpful to state this. The direction might be
characterized either as being towards (or away from) the null, or as being in favour of one of the
interventions.

NA / Favours
experimental / Favours
comparator / Towards
null /Away from null

flowchart LR
Q21["2.1 Participants aware of intervention?\n\n2.2 Personnel aware of intervention?"]
Q23["2.3 Balanced non-protocol interventions?"]
Q24["2.4 Failures in implementation affecting outcome?\n\n2.5 Non-adherence affecting outcome?"]
Q26["2.6 Appropriate analysis to estimate the effect of adhering?"]

    L["Low risk"]
    M["Some concerns"]
    H["High risk"]

    %% Awareness
    Q21 -- "Both N/PN" --> Q24
    Q21 -- "Either Y/PY/NI" --> Q23

    %% Balanced non-protocol interventions
    Q23 -- "NA/Y/PY" --> Q24
    Q23 -- "N/PN/NI" --> Q26

    %% Failures / non-adherence
    Q24 -- "Both NA/N/PN" --> L
    Q24 -- "Either Y/PY/NI" --> Q26

    %% Analysis appropriateness
    Q26 -- "Y/PY" --> M
    Q26 -- "N/PN/NI" --> H
