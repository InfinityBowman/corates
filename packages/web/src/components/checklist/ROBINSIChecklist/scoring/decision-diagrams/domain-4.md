````mermaid
flowchart TD
    A[4.1–4.3 Complete data for all participants?]

    A -->|All Y/PY| LOW1[LOW RISK OF BIAS]
    A -->|Any N/PN/NI| B[4.4 Complete-case analysis?]

    %% Complete-case path
    B -->|Y/PY/NI| C[4.5 Exclusion related to true outcome?]
    B -->|N/PN| D[4.7 Analysis based on imputation?]

    C -->|N/PN| LOW2[LOW RISK OF BIAS]
    C -->|Y/PY/NI| E[4.6 Outcome–missingness relationship explained by model?]

    E -->|Y/PY| F1[4.11 Evidence result not biased?]
    E -->|WN/NI| F2[4.11 Evidence result not biased?]
    E -->|SN| F3[4.11 Evidence result not biased?]

    %% Imputation path
    D -->|Y/PY| G[4.8 MAR/MCAR reasonable?]
    D -->|N/PN/NI| H[4.10 Alternative appropriate method?]

    G -->|Y/PY| I[4.9 Appropriate imputation?]
    G -->|N/PN/NI| F2

    I -->|Y/PY| LOW3[LOW RISK OF BIAS]
    I -->|WN/NI| F2
    I -->|SN| F3

    %% Alternative method path
    H -->|Y/PY| LOW4[LOW RISK OF BIAS]
    H -->|WN/NI| F2
    H -->|SN| F3

    %% Final evidence checks
    F1 -->|Y/PY| MOD1[MODERATE RISK OF BIAS]
    F1 -->|N/PN| SER1[SERIOUS RISK OF BIAS]

    F2 -->|Y/PY| MOD2[MODERATE RISK OF BIAS]
    F2 -->|N/PN| SER2[SERIOUS RISK OF BIAS]

    F3 -->|Y/PY| SER3[SERIOUS RISK OF BIAS]
    F3 -->|N/PN| CRIT[CRITICAL RISK OF BIAS]
    ```
````
