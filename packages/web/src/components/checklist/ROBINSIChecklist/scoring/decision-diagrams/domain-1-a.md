```mermaid
flowchart LR
  %% --------------------
  %% Core questions
  %% --------------------
  Q1["1.1 Controlled for all the important confounding factors?"]
  Q3a["1.3 Controlled for any post-intervention variables?"]
  Q3b["1.3 Controlled for any post-intervention variables?"]
  Q2a["1.2 Confounding factors measured validly and reliably?"]
  Q2b["1.2 Confounding factors measured validly and reliably?"]
  Q2c["1.2 Confounding factors measured validly and reliably?"]

  %% --------------------
  %% Negative controls
  %% --------------------
  NC1["1.4 Negative controls etc suggest serious uncontrolled confounding?"]
  NC2["1.4 Negative controls etc suggest serious uncontrolled confounding?"]
  NC3["1.4 Negative controls etc suggest serious uncontrolled confounding?"]
  NC4["1.4 Negative controls etc suggest serious uncontrolled confounding?"]

  %% --------------------
  %% Outcomes
  %% --------------------
  LOW_EX["LOW RISK OF BIAS\n(except for concerns about uncontrolled confounding)"]
  MOD["MODERATE RISK OF BIAS"]
  SER["SERIOUS RISK OF BIAS"]
  CRIT["CRITICAL RISK OF BIAS"]

  %% --------------------
  %% From 1.1
  %% --------------------
  Q1 -- "Y / PY" --> Q3a
  Q1 -- "WN" --> Q3b
  Q1 -- "SN / NI" --> NC1

  %% --------------------
  %% From 1.3 (top)
  %% --------------------
  Q3a -- "N / PN / NI" --> Q2a
  Q3a -- "Y / PY" --> NC3

  %% --------------------
  %% From 1.3 (middle)
  %% --------------------
  Q3b -- "N / PN / NI" --> Q2b
  Q3b -- "Y / PY" --> NC4

  %% --------------------
  %% From 1.2 (top)
  %% --------------------
  Q2a -- "Y / PY" --> NC2
  Q2a -- "WN" --> NC2
  Q2a -- "SN / NI" --> SER

  %% --------------------
  %% From 1.2 (middle)
  %% --------------------
  Q2b -- "Y / PY / WN" --> NC2
  Q2b -- "SN / NI" --> SER

  %% --------------------
  %% From 1.2 (bottom)
  %% --------------------
  Q2c -- "Y / PY" --> SER
  Q2c -- "SN / WN / NI" --> CRIT

  %% --------------------
  %% Negative controls → outcomes
  %% --------------------
  NC1 -- "N / PN" --> SER
  NC1 -- "Y / PY" --> CRIT

  NC2 -- "N / PN" --> LOW_EX
  NC2 -- "Y / PY" --> MOD

  NC3 -- "N / PN" --> SER
  NC3 -- "Y / PY" --> CRIT

  NC4 -- "N / PN" --> SER
  NC4 -- "Y / PY" --> CRIT
```
