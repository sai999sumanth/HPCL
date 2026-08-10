# 📊 Performance Scoring Framework Document

---

# 1. Overall Scoring Formula

The final performance score is a weighted aggregation of all major sections.

### Formula:

FINAL_SCORE =
(VA_SCORE × 0.30) +
(SALES_PERFORMANCE × 0.40) +
(DRYOUT_PATTERNS × 0.30)

### Key Points:

* Each section produces a normalized score between **0 and 100**
* Weightages define business priority
* Final score is also normalized to **0–100**

---

# 2. Section-wise Calculation Logic

Each section follows a **hierarchical weighted scoring model**:

### Generic Formula:

SECTION_SCORE = Σ (Metric Score × Metric Weightage)

### Rules:

* Each metric returns a **score between 0–100**
* Weightages within a section must sum to **100**
* Final section score is a weighted average

---

# 3. SALES_PERFORMANCE

### Weightage: 40%

This section evaluates overall business growth, target achievement, and historical comparison.

### Metrics:

1. Sales Growth %
2. Sales Achieved vs Target
3. Last Year vs Present Year (YoY)

### Formula:

SALES_SCORE =
(Growth_Score × 0.30) +
(Target_Score × 0.40) +
(YoY_Score × 0.30)

---

## 3.1 Sales Growth %

### Definition:

Measures short-term growth compared to the previous period.

### Formula:

Growth % = ((Current Sales - Previous Sales) / Previous Sales) × 100

### Scoring Logic:

* ≥ 20% → 100
* 0% to 20% → Linear scaling (50–100)
* < 0% → Penalized (0–50)

---

## 3.2 Sales Achieved vs Target

### Definition:

Measures performance against assigned targets.

### Formula:

Achievement % = (Actual Sales / Target Sales) × 100

### Scoring Logic:

* ≥ 100% → 100
* 90–100% → 80–100
* 70–90% → 50–80
* < 70% → < 50

---

## 3.3 Last Year vs Present Year (YoY)

### Definition:

Measures long-term growth compared to the same period last year.

### Formula:

YoY % = ((Current Year Sales - Last Year Sales) / Last Year Sales) × 100

### Scoring Logic:

* ≥ 15% → 100
* 0–15% → Linear scaling (50–100)
* < 0% → Penalized (0–50)

---

# 4. DRYOUT_PATTERNS (Penalty-Based Section)

### Weightage: 30%

This section evaluates operational inefficiencies due to stockouts (dryouts).

### Important Principle:

Higher values = Lower score (Penalty-based scoring)

---

### Metrics:

1. Dryout Frequency (Last 30 Days)
2. Sales Loss due to Dryout (Last 30 Days)
3. Max Dryout Days (Last 30 Days)

---

### Formula:

DRYOUT_SCORE =
(Frequency_Score × 0.30) +
(Loss_Score × 0.40) +
(MaxDays_Score × 0.30)

---

## 4.1 Dryout Frequency (Last 30 Days)

### Definition:

Number of dryout events in the last 30 days.

### Scoring Logic:

Score = 100 − (Dryout_Count × 10)

### Constraints:

* Minimum Score = 0
* 0 dryouts → 100 (best)

---

## 4.2 Sales Loss due to Dryout (Last 30 Days)

### Definition:

Percentage of sales lost due to dryout conditions.

### Formula:

Loss % = (Sales Loss due to Dryout / Total Sales) × 100

### Scoring Logic:

Score = 100 − (Loss % × 15)

### Insight:

* Higher loss → direct business impact
* Strong penalty weight (40%)

---

## 4.3 Max Dryout Days (Last 30 Days)

### Definition:

Maximum consecutive days of dryout in the last 30 days.

### Scoring Logic:

Score = 100 − (Max_Days × 20)

### Interpretation:

* 0 days → 100
* 1 day → 80
* 2 days → 60
* ≥ 5 days → Severe penalty

---

# 5. General Rules & Constraints

### Score Normalization:

* All metric scores must be within:
  0 ≤ Score ≤ 100

---

### Capping:

* If score > 100 → set to 100
* If score < 0 → set to 0

---

### Time Window:

* Dryout metrics must use:
  Last 30 days rolling window

---

### Data Quality:

* Handle division by zero cases
* Missing data → assign default or neutral score

---

# 6. Summary

* SALES_PERFORMANCE → Growth & revenue focus
* DRYOUT_PATTERNS → Operational efficiency (penalty-based)
* Final score balances **business performance + operational discipline**

---

# 7. Example

VA Score = 80
Sales Score = 70
Dryout Score = 60

FINAL_SCORE =
(80 × 0.30) + (70 × 0.40) + (60 × 0.30)
= 24 + 28 + 18
= 70

---

End of Document
