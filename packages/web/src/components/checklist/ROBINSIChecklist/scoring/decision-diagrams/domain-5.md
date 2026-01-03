```mermaid
flowchart LR
  %% --------------------
  %% Core questions
  %% --------------------
  Q1["5.1 Measurement of outcome differs by intervention?"]

  Q2a["5.2 Outcome assessors aware of intervention received?"]
  Q2b["5.2 Outcome assessors aware of intervention received?"]

  Q3a["5.3 Assessment could be influenced by knowledge of intervention?"]
  Q3b["5.3 Assessment could be influenced by knowledge of intervention?"]

  %% --------------------
  %% Outcomes
  %% --------------------
  LOW["LOW RISK OF BIAS"]
  MOD["MODERATE RISK OF BIAS"]
  SER["SERIOUS RISK OF BIAS"]

  %% --------------------
  %% From 5.1
  %% --------------------
  Q1 -- "N / PN" --> Q2a
  Q1 -- "NI" --> Q2b
  Q1 -- "Y / PY" --> SER

  %% --------------------
  %% From 5.2 (top)
  %% --------------------
  Q2a -- "N / PN" --> LOW
  Q2a -- "Y / PY / NI" --> Q3a

  %% --------------------
  %% From 5.2 (middle)
  %% --------------------
  Q2b -- "N / PN" --> MOD
  Q2b -- "Y / PY / NI" --> Q3b

  %% --------------------
  %% From 5.3 (top)
  %% --------------------
  Q3a -- "N / PN" --> LOW
  Q3a -- "WY / NI" --> MOD
  Q3a -- "SY" --> SER

  %% --------------------
  %% From 5.3 (middle)
  %% --------------------
  Q3b -- "WY / N / PN / NI" --> MOD
  Q3b -- "SY" --> SER
  ```
