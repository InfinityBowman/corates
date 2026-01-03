```mermaid
flowchart LR
  %% --------------------
  %% Section A
  %% --------------------
  subgraph A["A. Follow-up and early outcomes"]
    A1["3.1 Participants followed from start of intervention?"]

    A2["3.2 Early outcome events excluded?"]

    A1 -- "Y / PY" --> A2
    A1 -- "WN / NI" --> A_MOD["MODERATE"]
    A1 -- "SN" --> A_SER["SERIOUS"]

    A2 -- "N / PN / NI" --> A_LOW["LOW"]
    A2 -- "Y / PY" --> A_MOD
  end

  %% --------------------
  %% Section B
  %% --------------------
  subgraph B["B. Selection bias"]
    B1["3.3 Selection based on characteristics after start?"]
    B2["3.4 Selection variables associated with intervention?"]
    B3["3.5 Selection variables influenced by outcome?"]

    B1 -- "N / PN" --> B_LOW1["LOW"]
    B1 -- "Y / PY" --> B2
    B1 -- "NI" --> B_MOD1["MODERATE"]

    B2 -- "N / PN" --> B_LOW2["LOW"]
    B2 -- "Y / PY" --> B3
    B2 -- "NI" --> B_MOD2["MODERATE"]

    B3 -- "N / PN / NI" --> B_MOD3["MODERATE"]
    B3 -- "Y / PY" --> B_SER["SERIOUS"]
  end

  %% --------------------
  %% Combine A and B
  %% --------------------
  subgraph AB["Across A and B"]
    AB_LOW["All LOW"]
    AB_MOD["At worst MODERATE"]
    AB_SER["At least one SERIOUS"]
  end

  A_LOW --> AB_LOW
  B_LOW1 --> AB_LOW
  B_LOW2 --> AB_LOW

  A_MOD --> AB_MOD
  B_MOD1 --> AB_MOD
  B_MOD2 --> AB_MOD
  B_MOD3 --> AB_MOD

  A_SER --> AB_SER
  B_SER --> AB_SER

  %% --------------------
  %% Final adjustments
  %% --------------------
  AB_LOW --> LOW_RISK["LOW RISK OF BIAS"]
  AB_MOD --> MOD_RISK["MODERATE RISK OF BIAS"]

  AB_SER --> C1["3.6 Analysis corrected for selection biases?"]

  C1 -- "Y / PY" --> MOD_RISK
  C1 -- "N / PN / NI" --> C2["3.7 Sensitivity analyses demonstrate minimal impact?"]

  C2 -- "Y / PY" --> MOD_RISK
  C2 -- "N / PN / NI" --> C3["3.8 Selection biases severe?"]

  C3 -- "N / PN / NI" --> SER_RISK["SERIOUS RISK OF BIAS"]
  C3 -- "Y / PY" --> CRIT_RISK["CRITICAL RISK OF BIAS"]
  ```
