```mermaid
flowchart LR
  %% --------------------
  %% Core questions
  %% --------------------
  Q1["6.1 Result reported according to analysis plan?"]

  Q2["6.2 Multiple outcome measurements?"]
  Q3["6.3 Multiple analyses of the data?"]
  Q4["6.4 Multiple subgroups?"]

  %% --------------------
  %% Aggregated decision node
  %% --------------------
  SEL["Result selected from:\n6.2 / 6.3 / 6.4"]

  %% --------------------
  %% Outcomes
  %% --------------------
  LOW["LOW RISK OF BIAS"]
  MOD["MODERATE RISK OF BIAS"]
  SER["SERIOUS RISK OF BIAS"]
  CRIT["CRITICAL RISK OF BIAS"]

  %% --------------------
  %% From 6.1
  %% --------------------
  Q1 -- "Y / PY" --> LOW
  Q1 -- "N / PN / NI" --> SEL

  %% --------------------
  %% From selection set (6.2–6.4)
  %% --------------------
  SEL -- "All N / PN" --> LOW
  SEL -- "At least one NI,\nbut none Y / PY" --> MOD
  SEL -- "One Y / PY,\nor all NI" --> SER
  SEL -- "Two or more Y / PY" --> CRIT
  ```
