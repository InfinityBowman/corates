Domain 2: Risk of bias due to deviations from the intended interventions (effect of assignment to intervention)
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
carers or people delivering the interventions knew to be specific to one of the interventions, answer
question ‘Yes’ or ‘Probably yes’. If randomized allocation was not concealed, then it is likely that carers
and people delivering the interventions were aware of participants' assigned intervention during the
trial.

Y/PY/PN/N/NI

8

2.3. If Y/PY/NI to 2.1 or
2.2: Were there
deviations from the
intended intervention
that arose because of the
trial context?

For the effect of assignment to intervention, this domain assesses problems that arise when changes from
assigned intervention that are inconsistent with the trial protocol arose because of the trial context. We
use the term trial context to refer to effects of recruitment and engagement activities on trial participants
and when trial personnel (carers or people delivering the interventions) undermine the implementation of
the trial protocol in ways that would not happen outside the trial. For example, the process of securing
informed consent may lead participants subsequently assigned to the comparator group to feel unlucky
and therefore seek the experimental intervention, or other interventions that improve their prognosis.
Answer ‘Yes’ or ‘Probably yes’ only if there is evidence, or strong reason to believe, that the trial context
led to failure to implement the protocol interventions or to implementation of interventions not allowed
by the protocol.
Answer ‘No’ or ‘Probably no’ if there were changes from assigned intervention that are inconsistent with
the trial protocol, such as non-adherence to intervention, but these are consistent with what could occur
outside the trial context.
Answer ‘No’ or ‘Probably no’ for changes to intervention that are consistent with the trial protocol, for
example cessation of a drug intervention because of acute toxicity or use of additional interventions whose
aim is to treat consequences of one of the intended interventions.
If blinding is compromised because participants report side effects or toxicities that are specific to one of
the interventions, answer ‘Yes’ or ‘Probably yes’ only if there were changes from assigned intervention
that are inconsistent with the trial protocol and arose because of the trial context.
The answer ‘No information’ may be appropriate, because trialists do not always report whether
deviations arose because of the trial context.

NA/Y/PY/PN/N/NI

2.4 If Y/PY to 2.3: Were
these deviations likely to
have affected the
outcome?

Changes from assigned intervention that are inconsistent with the trial protocol and arose because of the
trial context will impact on the intervention effect estimate if they affect the outcome, but not
otherwise.

NA/Y/PY/PN/N/NI

9

2.5. If Y/PY/NI to 2.4:
Were these deviations
from intended
intervention balanced
between groups?

Changes from assigned intervention that are inconsistent with the trial protocol and arose because of the
trial context are more likely to impact on the intervention effect estimate if they are not balanced
between the intervention groups.

NA/Y/PY/PN/N/NI

2.6 Was an appropriate
analysis used to estimate
the effect of assignment
to intervention?

Both intention-to-treat (ITT) analyses and modified intention-to-treat (mITT) analyses excluding
participants with missing outcome data should be considered appropriate. Both naïve ‘per-protocol’
analyses (excluding trial participants who did not receive their assigned intervention) and ‘as treated’
analyses (in which trial participants are grouped according to the intervention that they received, rather
than according to their assigned intervention) should be considered inappropriate. Analyses excluding

eligible trial participants post-randomization should also be considered inappropriate, but post-
randomization exclusions of ineligible participants (when eligibility was not confirmed until after

randomization, and could not have been influenced by intervention group assignment) can be
considered appropriate.

Y/PY/PN/N/NI

2.7 If N/PN/NI to 2.6:
Was there potential for a
substantial impact (on
the result) of the failure
to analyse participants in
the group to which they
were randomized?

This question addresses whether the number of participants who were analysed in the wrong
intervention group, or excluded from the analysis, was sufficient that there could have been a substantial
impact on the result. It is not possible to specify a precise rule: there may be potential for substantial
impact even if fewer than 5% of participants were analysed in the wrong group or excluded, if the
outcome is rare or if exclusions are strongly related to prognostic factors.

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
null /Away from null /
Unpredictable

flowchart LR
%% -----------------------
%% Part 1
%% -----------------------
subgraph P1["Part 1: Questions 2.1 to 2.5"]
Q21["2.1 Participants aware of intervention?\n\n2.2 Personnel aware of intervention?"]
Q23["2.3 Deviations that arose because of the trial context?"]
Q24["2.4 Deviations affect outcome?"]
Q25["2.5 Deviations balanced between groups?"]

        P1Low["Low risk"]
        P1Some["Some concerns"]
        P1High["High risk"]

        Q21 -- "Both N/PN" --> P1Low
        Q21 -- "Either Y/PY/NI" --> Q23

        Q23 -- "N/PN" --> P1Low
        Q23 -- "NI" --> P1Some
        Q23 -- "Y/PY" --> Q24

        Q24 -- "N/PN" --> P1Some
        Q24 -- "Y/PY/NI" --> Q25

        Q25 -- "Y/PY" --> P1Some
        Q25 -- "N/PN/NI" --> P1High
    end

    %% -----------------------
    %% Part 2
    %% -----------------------
    subgraph P2["Part 2: Questions 2.6 & 2.7"]
        Q26["2.6 Appropriate analysis to estimate the effect of assignment?"]
        Q27["2.7 Substantial impact of the failure to analyse participants in randomized groups?"]

        P2Low["Low risk"]
        P2Some["Some concerns"]
        P2High["High risk"]

        Q26 -- "Y/PY" --> P2Low
        Q26 -- "N/PN/NI" --> Q27

        Q27 -- "N/PN" --> P2Some
        Q27 -- "Y/PY/NI" --> P2High
    end

    %% -----------------------
    %% Overall domain judgement
    %% -----------------------
    subgraph D["Criteria for the domain"]
        DLow["Low risk"]
        DSome["Some concerns"]
        DHigh["High risk"]
    end

    P1Low --> DLow
    P2Low --> DLow

    P1Some --> DSome
    P2Some --> DSome

    P1High --> DHigh
    P2High --> DHigh
