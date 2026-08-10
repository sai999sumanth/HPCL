# Performance Score Insights Implementation Summary

## What Has Been Implemented

### 1. New Insights Module (`performance_score_insights.py`)

Created a comprehensive insights module that provides:

- **Score Gap Calculation**: Calculates the difference between current and maximum possible scores
- **Priority Level Assignment**: Automatically assigns CRITICAL, HIGH, MEDIUM, LOW, or NONE based on score gap
- **Reason Generation**: Creates structured reasons explaining why scores are reduced
- **Action Recommendations**: Generates specific, actionable recommendations based on module type
- **Summary Insights**: Aggregates insights at module and overall levels

### 2. Enhanced Result Structure

Each result now includes:
- `reason`: Detailed explanation of score reduction
- `actions`: List of prioritized actionable recommendations
- `priority`: Priority level for this result
- `details`: Additional context-specific details

### 3. Module-Level Insights

Each module now includes:
- `insights`: Summary containing:
  - Total score gap for the module
  - Critical issues list
  - High priority actions
  - Quick wins

### 4. Overall Insights

Location-level insights include:
- Overall score and gap
- Improvement potential percentage
- Top priority modules
- Critical issues across all modules
- Recommended actions (top 15)
- Focus areas (top 3)

### 5. Integration Examples

Updated modules:
- ✅ `_compute_pq_pi_score` (LPG) - PQ Rejection module
- ✅ `_compute_va_pi_score` (LPG) - VA module
- ✅ `_compute_safety_interlocks_pi_score` (SOD) - Safety Interlocks module
- ✅ `generate_performance_score` - Overall insights integration

## Module Types Supported

The system automatically generates appropriate actions for:

1. **Alert-based modules**: `open_alerts`
2. **Rejection-based modules**: `percentage_rejection`
3. **VA Portal**: `va_portal`, `va_alerts`
4. **Production metrics**: `production`
5. **Productivity metrics**: `productivity`
6. **Breakdown/Uptime**: `breakdown`
7. **Interlock modules**: `safety_interlocks`, `gantry_interlocks`, `process_interlocks`
8. **Quantity monitoring**: `water_quantity`, `foam_quantity`
9. **Fire safety**: `fire_engines_auto_mode`, `hydrant_line`
10. **Vehicle systems**: `emlock`, `vts`
11. **Dryout management**: `dryout`

## What Needs to Be Done

### Remaining Modules to Update

#### LPG Modules:
- [ ] `_compute_vts_pi_score` - VTS module
- [ ] `_compute_production_pi_score` - Production module
- [ ] `_compute_productivity_pi_score` - Productivity module
- [ ] `_compute_break_down_pi_score` - Breakdown module

#### SOD Modules:
- [ ] `_compute_gantry_interlocks_pi_score` - Gantry Interlocks
- [ ] `_compute_process_interlocks_pi_score` - Process Interlocks
- [ ] `_compute_va_pi_score` - VA module
- [ ] `_compute_vts_pi_score` - VTS module
- [ ] `_compute_water_quantity_pi_score` - Water Quantity
- [ ] `_compute_foam_quantity_pi_score` - Foam Quantity
- [ ] `_compute_fire_engines_in_auto_mode_pi_score` - Fire Engines
- [ ] `_compute_hydrant_line_pi_score` - Hydrant Line
- [ ] `_compute_emlock_pi_score` - EMLock
- [ ] `_compute_dryout_pi_score` - Dryout

### Integration Pattern

For each module function, follow this pattern:

```python
# 1. Create result item with details
result_item = {
    "name": rule["name"],
    "score": round(score, 2),
    "weightage": rule_weightage,
    "module": rules.get("name", name),
    "msg": msg,
    "details": {
        # Add relevant context-specific details
        "current_value": some_value,
        "threshold_min": min_val,
        "threshold_max": max_val,
        "device_count": count,
        # etc.
    }
}

# 2. Enhance with insights
module_type = rule["model"]  # or appropriate type
result_item = enhance_result_with_insights(result_item, module_type)
pi_score.append(result_item)

# 3. At module return, add module insights
module_result = {
    "name": rules.get("name", name),
    "score": final_score,
    "weightage": rules["weightage"],
    "results": pi_score
}

module_result["insights"] = generate_summary_insights(module_result)
return module_result
```

## Key Details to Capture in `details`

Based on module type, capture relevant details:

### For Alert-based:
- `alert_count`: Number of open alerts
- `affected_devices`: List of affected devices
- `interlock_names`: List of interlock names

### For Rejection-based:
- `current_value`: Current rejection percentage
- `threshold_min`: Minimum threshold
- `threshold_max`: Maximum threshold
- `rejection_type`: Type of rejection

### For Production/Productivity:
- `current_value`: Current production/productivity
- `target_value`: Target or average value
- `variance`: Difference from target

### For Interlock-based:
- `unhealthy_devices`: Count of devices with alerts
- `total_devices`: Total device count
- `affected_interlocks`: List of interlock names

### For Quantity-based:
- `available_quantity`: Current available quantity
- `required_quantity`: Required threshold
- `target_quantity`: Target level

## Priority Focus Areas

The system automatically identifies:

1. **Critical Issues**: Score gaps > 5% - Immediate attention required
2. **High Priority**: Score gaps > 2% - High impact improvements
3. **Quick Wins**: Medium/Low priority with score gap > 1 point
4. **Focus Areas**: Top 3 modules with highest improvement potential

## Benefits

1. **Actionable Insights**: Clear, specific actions to improve scores
2. **Prioritization**: Know where to focus efforts first
3. **Transparency**: Understand why scores are what they are
4. **Impact Assessment**: See potential score improvement for each action
5. **Resource Allocation**: Data-driven decision making

## Testing

After updating each module:

1. Run the performance score generation
2. Verify `reason`, `actions`, and `priority` fields are populated
3. Check that module-level `insights` are generated
4. Verify overall `insights` at location level
5. Test with different score scenarios (high, medium, low scores)

## Example Output

```json
{
  "sap_id": "2662",
  "score": 85.5,
  "insights": {
    "overall_score": 85.5,
    "overall_gap": 14.5,
    "improvement_potential": 14.5,
    "focus_areas": [
      {
        "module": "PQ Rejection",
        "reason": "Score gap of 4.5 points (CRITICAL priority)",
        "potential_impact": "Can improve overall score by 4.5%"
      }
    ],
    "recommended_actions": [
      {
        "action": "Resolve open alerts immediately",
        "priority": "CRITICAL",
        "description": "Close all open alerts for PQ Check Scale Rejection Alert...",
        "impact": "Can recover up to 3.34 points"
      }
    ]
  },
  "category": [
    {
      "name": "PQ Rejection",
      "score": 15.5,
      "weightage": 20.0,
      "insights": {
        "total_score_gap": 4.5,
        "critical_issues": [...]
      },
      "results": [
        {
          "name": "PQ Check Scale Rejection Alert",
          "score": 0.0,
          "weightage": 3.34,
          "reason": {...},
          "actions": [...],
          "priority": "CRITICAL"
        }
      ]
    }
  ]
}
```

## Next Steps

1. Update remaining modules following the integration pattern
2. Test with real data
3. Review and refine action recommendations
4. Add custom business-specific actions if needed
5. Integrate with frontend dashboards
6. Add historical trend analysis for insights
