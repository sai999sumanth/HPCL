"""
Performance Score Insights Module

This module provides helper functions to generate insights, reasons, and actionable recommendations
for performance score results.
"""

from typing import Dict, List, Optional, Any
import numpy as np


def convert_numpy_types(obj: Any) -> Any:
    """
    Recursively convert numpy types to Python native types.
    
    Args:
        obj: Object that may contain numpy types
        
    Returns:
        Object with numpy types converted to Python types
    """
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(round(obj, 2))
    elif isinstance(obj, np.ndarray):
        return [convert_numpy_types(item) for item in obj.tolist()]
    elif isinstance(obj, dict):
        return {key: convert_numpy_types(value) for key, value in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return type(obj)([convert_numpy_types(item) for item in obj])
    else:
        return obj


def calculate_score_gap(current_score: float, max_score: float) -> float:
    """Calculate the gap between current score and maximum possible score."""
    return float(round(max(0, max_score - current_score), 2))


def get_priority_level(score_gap: float, weightage: float, max_total_score: float = 100) -> str:
    """
    Determine priority level based on score gap and weightage.
    
    Priority levels:
    - CRITICAL: Score gap > 5 points OR > 50% of weightage
    - HIGH: Score gap > 2 points OR > 20% of weightage
    - MEDIUM: Score gap > 1 point OR > 10% of weightage
    - LOW: Score gap <= 1 point AND <= 10% of weightage
    """
    if score_gap == 0:
        return "NONE"
    
    # Calculate gap as percentage of weightage
    gap_percentage_of_weightage = float(round((score_gap / weightage * 100) if weightage > 0 else 0, 2))
    
    # Use both absolute gap and percentage of weightage
    if score_gap > 5 or gap_percentage_of_weightage > 50:
        return "CRITICAL"
    elif score_gap > 2 or gap_percentage_of_weightage > 20:
        return "HIGH"
    elif score_gap > 1 or gap_percentage_of_weightage > 10:
        return "MEDIUM"
    else:
        return "LOW"


def generate_reason_for_score(score: float, weightage: float, msg: str = "", 
                              details: Optional[Dict] = None) -> Dict:
    """
    Generate structured reason for score reduction.
    
    Args:
        score: Current score achieved
        weightage: Maximum possible score (weightage)
        msg: Existing message/explanation
        details: Additional details dictionary
    
    Returns:
        Dictionary with reason details
    """
    score_gap = calculate_score_gap(score, weightage)
    percentage_achieved = float(round((score / weightage * 100) if weightage > 0 else 0, 2))
    
    reason = {
        "score_achieved": float(round(score, 2)),
        "max_possible": float(round(weightage, 2)),
        "score_gap": float(round(score_gap, 2)),
        "percentage_achieved": float(round(percentage_achieved, 2)),
        "section_score": float(round(score, 2)),  # Score within its section
        "section_weightage": float(round(weightage, 2)),  # Weightage within its section
        "explanation": msg or "No specific reason provided",
        "priority": get_priority_level(score_gap, weightage)
    }
    # Note: contribution_to_overall_score will be calculated later when we know parent/category weightages
    
    if details:
        # Convert numpy types in details before updating
        converted_details = convert_numpy_types(details)
        reason.update(converted_details)
    
    return reason


def generate_actions_for_improvement(module_name: str, rule_name: str, score: float, 
                                     weightage: float, reason: Dict, 
                                     module_type: str = "general") -> List[Dict]:
    """
    Generate actionable recommendations based on module type and score.
    
    Args:
        module_name: Name of the module (e.g., "PQ Rejection", "Safety Interlocks")
        rule_name: Name of the specific rule
        score: Current score
        weightage: Maximum possible score
        reason: Reason dictionary with details
        module_type: Type of module (e.g., "open_alerts", "percentage_rejection", "va_portal")
    
    Returns:
        List of action dictionaries with priority and description
    """
    actions = []
    score_gap = calculate_score_gap(score, weightage)
    
    if score_gap == 0:
        return [{
            "action": "Maintain current performance",
            "priority": "NONE",
            "description": f"{rule_name} is performing optimally. Continue monitoring."
        }]
    
    # Module-specific actions
    if module_type == "open_alerts":
        actions.append({
            "action": "Resolve open alerts immediately",
            "priority": reason.get("priority", "HIGH"),
            "description": f"Close all open alerts for {rule_name} to restore full score. Review alert history and take corrective action.",
            "impact": f"Can recover up to {float(round(score_gap, 2))} points on overall score"
        })
        actions.append({
            "action": "Review alert root causes",
            "priority": "MEDIUM",
            "description": f"Analyze why alerts are occurring for {rule_name}. Implement preventive measures.",
            "impact": "Prevents future score reduction"
        })
        
    elif module_type == "percentage_rejection":
        current_value = reason.get("current_value", 0)
        threshold_min = reason.get("threshold_min", 0)
        threshold_max = reason.get("threshold_max", 0)
        
        if current_value > threshold_max:
            actions.append({
                "action": "Reduce rejection percentage",
                "priority": reason.get("priority", "CRITICAL"),
                "description": f"Current rejection rate ({float(round(current_value, 2))}%) exceeds maximum threshold ({float(round(threshold_max, 2))}%). Take immediate action to improve quality control.",
                "impact": f"Can recover up to {float(round(score_gap, 2))} points on overall score"
            })
            actions.append({
                "action": "Review quality control processes",
                "priority": "HIGH",
                "description": "Investigate root causes of high rejection. Review equipment calibration, operator training, and process parameters.",
                "impact": "Long-term improvement"
            })
        elif current_value < threshold_min:
            actions.append({
                "action": "Maintain current rejection levels",
                "priority": "LOW",
                "description": f"Rejection rate ({float(round(current_value, 2))}%) is below minimum threshold ({float(round(threshold_min, 2))}%). Continue current practices.",
                "impact": "Maintains current score"
            })
            
    elif module_type == "va_portal":
        actions.append({
            "action": "Improve VA Portal score",
            "priority": reason.get("priority", "MEDIUM"),
            "description": f"Work on improving overall VA Portal score. Review VA dashboard metrics and address identified issues.",
            "impact": f"Can recover up to {float(round(score_gap, 2))} points on overall score"
        })
        actions.append({
            "action": "Address VA alert severity issues",
            "priority": "HIGH",
            "description": "Focus on resolving high and critical severity alerts in VA system.",
            "impact": "Improves VA Portal overall score"
        })
        
    elif module_type == "production":
        actions.append({
            "action": "Increase production output",
            "priority": reason.get("priority", "HIGH"),
            "description": f"Yesterday's production was below weekly average. Review production schedules and equipment efficiency.",
            "impact": f"Can recover up to {float(round(score_gap, 2))} points on overall score"
        })
        actions.append({
            "action": "Optimize production planning",
            "priority": "MEDIUM",
            "description": "Review production planning to ensure consistent output throughout the week.",
            "impact": "Prevents future score reduction"
        })
        
    elif module_type == "productivity":
        actions.append({
            "action": "Improve filling head productivity",
            "priority": reason.get("priority", "HIGH"),
            "description": f"Productivity is below optimal levels. Review carousel operations, operator efficiency, and equipment maintenance.",
            "impact": f"Can recover up to {float(round(score_gap, 2))} points on overall score"
        })
        actions.append({
            "action": "Optimize carousel operations",
            "priority": "MEDIUM",
            "description": "Review carousel scheduling and operator assignments to maximize productivity.",
            "impact": "Long-term productivity improvement"
        })
        
    elif module_type == "breakdown":
        actions.append({
            "action": "Reduce breakdown hours",
            "priority": reason.get("priority", "CRITICAL"),
            "description": f"Breakdown hours are affecting uptime. Implement preventive maintenance and quick response protocols.",
            "impact": f"Can recover up to {float(round(score_gap, 2))} points on overall score"
        })
        actions.append({
            "action": "Implement preventive maintenance",
            "priority": "HIGH",
            "description": "Schedule regular preventive maintenance to reduce unexpected breakdowns.",
            "impact": "Reduces future breakdown incidents"
        })
        
    elif module_type == "safety_interlocks" or module_type == "gantry_interlocks" or module_type == "process_interlocks":
        unhealthy_count = reason.get("unhealthy_devices", 0)
        total_devices = reason.get("total_devices", 0)
        
        # Only add action if there are actual issues (unhealthy_count > 0) or if score is low
        if unhealthy_count > 0 or score_gap > 0:
            if unhealthy_count > 0:
                actions.append({
                    "action": "Resolve interlock alerts",
                    "priority": reason.get("priority", "CRITICAL"),
                    "description": f"{unhealthy_count} out of {total_devices} devices have active alerts. Resolve these immediately for safety compliance.",
                    "impact": f"Can recover up to {float(round(score_gap, 2))} points on overall score"
                })
            else:
                # Score gap exists but no unhealthy devices - might be a configuration issue
                actions.append({
                    "action": "Review interlock configuration",
                    "priority": reason.get("priority", "MEDIUM"),
                    "description": f"Score gap of {float(round(score_gap, 2))} points exists but no unhealthy devices detected. Review configuration and calculation logic.",
                    "impact": f"Can recover up to {float(round(score_gap, 2))} points on overall score"
                })
        
        # Only add maintenance review if there are devices
        if total_devices > 0:
            actions.append({
                "action": "Review maintenance schedules",
                "priority": "HIGH",
                "description": "Ensure all devices are properly maintained and calibrated. Check for 'Tank_Under Maintenance' status.",
                "impact": "Prevents future interlock violations"
            })
        
    elif module_type == "water_quantity" or module_type == "foam_quantity":
        available = reason.get("available_quantity", 0)
        required = reason.get("required_quantity", 0)
        target = reason.get("target_quantity", 0)
        
        if available < required:
            actions.append({
                "action": "Refill immediately",
                "priority": "CRITICAL",
                "description": f"Available quantity ({float(round(available, 2))}) is below required threshold ({float(round(required, 2))}). Refill immediately for safety compliance.",
                "impact": f"Can recover up to {float(round(score_gap, 2))} points on overall score"
            })
        elif available < target:
            actions.append({
                "action": "Top up to target level",
                "priority": "MEDIUM",
                "description": f"Available quantity ({float(round(available, 2))}) is below target ({float(round(target, 2))}). Top up to optimal level.",
                "impact": f"Can recover up to {float(round(score_gap, 2))} points on overall score"
            })
            
    elif module_type == "fire_engines_auto_mode":
        actions.append({
            "action": "Switch fire engines to auto mode",
            "priority": "CRITICAL",
            "description": "Fire engines detected in local mode. Switch to auto mode immediately for safety compliance.",
            "impact": f"Can recover up to {float(round(score_gap, 2))} points on overall score"
        })
        
    elif module_type == "hydrant_line":
        actions.append({
            "action": "Check hydrant line pressure",
            "priority": reason.get("priority", "HIGH"),
            "description": "Ensure hydrant line pressure is maintained above 7 Kg. Check jockey pump status.",
            "impact": f"Can recover up to {float(round(score_gap, 2))} points on overall score"
        })
        actions.append({
            "action": "Verify jockey pump auto mode",
            "priority": "HIGH",
            "description": "Ensure jockey pump is in auto-remote mode for proper pressure maintenance.",
            "impact": "Maintains hydrant line pressure"
        })
        
    elif module_type == "emlock" or module_type == "vts":
        affected_count = reason.get("affected_vehicles", 0)
        total_count = reason.get("total_vehicles", 0)
        
        # Only add action if there are actual issues (affected_count > 0) or if score is low
        if affected_count > 0 or score_gap > 0:
            if affected_count > 0:
                actions.append({
                    "action": "Resolve vehicle interlock issues",
                    "priority": reason.get("priority", "HIGH"),
                    "description": f"{affected_count} out of {total_count} vehicles have active interlock alerts. Resolve these to restore compliance.",
                    "impact": f"Can recover up to {float(round(score_gap, 2))} points on overall score"
                })
            else:
                # Score gap exists but no active alerts - might be a configuration or calculation issue
                actions.append({
                    "action": "Review vehicle interlock configuration",
                    "priority": reason.get("priority", "MEDIUM"),
                    "description": f"Score gap of {float(round(score_gap, 2))} points exists but no active alerts detected. Review configuration and calculation logic.",
                    "impact": f"Can recover up to {float(round(score_gap, 2))} points on overall score"
                })
        
        # Only add maintenance review if there are vehicles
        if total_count > 0:
            actions.append({
                "action": "Review vehicle maintenance",
                "priority": "MEDIUM",
                "description": "Ensure all vehicles are properly maintained and compliant with interlock requirements.",
                "impact": "Prevents future violations"
            })
        
    elif module_type == "dryout":
        actions.append({
            "action": "Execute carry forwards and dryouts",
            "priority": reason.get("priority", "HIGH"),
            "description": "Improve execution rate of placed carry forwards and dryouts. Review execution processes.",
            "impact": f"Can recover up to {float(round(score_gap, 2))} points on overall score"
        })
        actions.append({
            "action": "Reduce carry forward placement",
            "priority": "MEDIUM",
            "description": "Work on reducing the need for carry forwards by improving planning and execution.",
            "impact": "Long-term improvement"
        })
    
    # Default actions if no specific type matched
    if not actions:
        priority = reason.get("priority", get_priority_level(score_gap, weightage))
        # score_gap is already the impact on global score (out of 100)
        global_impact_pct = float(round((score_gap / 100) * 100, 2) if score_gap > 0 else 0)
        actions.append({
            "action": f"Review {rule_name} performance",
            "priority": priority,
            "description": f"Current score is {float(round(score, 2))} out of {float(round(weightage, 2))} (achieved {float(round((score/weightage*100), 2) if weightage > 0 else 0)}%). Review performance metrics and identify improvement areas.",
            "impact": f"Can recover up to {float(round(score_gap, 2))} points on overall score ({float(round(global_impact_pct, 2))}% of total score)"
        })
        
        # Add more specific actions based on score gap
        # score_gap is already the impact on global score (out of 100)
        global_impact_pct = float(round((score_gap / 100) * 100, 2) if score_gap > 0 else 0)
        if score_gap > 5:
            actions.append({
                "action": f"Immediate action required for {rule_name}",
                "priority": "CRITICAL",
                "description": f"Large score gap of {float(round(score_gap, 2))} points indicates significant performance issues. Conduct root cause analysis.",
                "impact": f"Can recover up to {float(round(score_gap, 2))} points on overall score ({float(round(global_impact_pct, 2))}% of total score)"
            })
        elif score_gap > 2:
            actions.append({
                "action": f"Prioritize improvements for {rule_name}",
                "priority": "HIGH",
                "description": f"Score gap of {float(round(score_gap, 2))} points requires attention. Review processes and implement corrective measures.",
                "impact": f"Can recover up to {float(round(score_gap, 2))} points on overall score ({float(round(global_impact_pct, 2))}% of total score)"
            })
    
    return actions


def enhance_result_with_insights(result: Dict, module_type: str = "general") -> Dict:
    """
    Enhance a result dictionary with insights, reasons, and actions.
    
    Args:
        result: Result dictionary with at least 'name', 'score', 'weightage'
        module_type: Type of module for generating specific actions
    
    Returns:
        Enhanced result dictionary
    """
    # Convert numpy types in result before processing
    result = convert_numpy_types(result)
    
    score = float(result.get("score", 0))
    weightage = float(result.get("weightage", 0))
    msg = result.get("msg", "")
    
    # Generate reason
    reason = generate_reason_for_score(score, weightage, msg, result.get("details", {}))
    
    # Generate actions
    actions = generate_actions_for_improvement(
        result.get("module", ""),
        result.get("name", ""),
        score,
        weightage,
        reason,
        module_type
    )
    
    # Calculate nested contribution if parent/category weightages are available
    parent_weightage = float(result.get("parent_weightage", 0))
    category_weightage = float(result.get("category_weightage", 0))
    
    if parent_weightage > 0 or category_weightage > 0:
        if parent_weightage == 0:
            parent_weightage = category_weightage
        
        nested_contribution = calculate_nested_contribution(
            score, weightage, parent_weightage, category_weightage
        )
        reason.update(nested_contribution)
    
    # Add insights to result
    result["reason"] = reason
    result["actions"] = actions
    result["priority"] = reason["priority"]
    
    # Ensure score and weightage are Python floats
    result["score"] = float(round(score, 2))
    result["weightage"] = float(round(weightage, 2))
    
    return result


def generate_summary_insights(module_results: Dict, parent_weightage: float = 0, category_weightage: float = 0) -> Dict:
    """
    Generate summary insights for a module with multiple results.
    
    Args:
        module_results: Module result dictionary with 'results' list
        parent_weightage: Weightage of parent module (e.g., TAS = 20 for Safety_Interlocks)
        category_weightage: Weightage of category module (fallback if parent_weightage is 0)
    
    Returns:
        Summary insights dictionary
    """
    # Convert numpy types in module_results before processing
    module_results = convert_numpy_types(module_results)
    
    results = module_results.get("results", [])
    module_score = float(module_results.get("score", 0))
    module_weightage = float(module_results.get("weightage", 0))
    
    # Calculate module's contribution to overall score
    if parent_weightage > 0:
        # This module is nested within a parent (e.g., Safety_Interlocks within TAS)
        module_max_contribution = (module_weightage / 100) * parent_weightage
        module_actual_contribution = (module_score / module_weightage) * module_max_contribution if module_weightage > 0 else 0
    elif category_weightage > 0:
        # This module is directly under category
        module_max_contribution = (module_weightage / 100) * category_weightage
        module_actual_contribution = (module_score / module_weightage) * module_max_contribution if module_weightage > 0 else 0
    else:
        # Direct category module (e.g., TAS itself)
        module_max_contribution = module_weightage
        module_actual_contribution = module_score
    
    if not results:
        return {
            "total_score_gap": float(0),
            "contribution_to_overall_score": float(round(module_actual_contribution, 2)),
            "max_contribution_to_overall_score": float(round(module_max_contribution, 2)),
            "module_score": float(round(module_score, 2)),
            "module_weightage": float(round(module_weightage, 2)),
            "contribution_percentage": float(round((module_actual_contribution / 100) * 100, 4)),
            "max_contribution_percentage": float(round((module_max_contribution / 100) * 100, 4)),
            "critical_issues": [],
            "high_priority_actions": [],
            "quick_wins": []
        }
    
    total_score_gap = 0
    critical_issues = []
    high_priority_actions = []
    quick_wins = []
    
    # Determine effective parent weightage for nested calculations
    effective_parent_weightage = parent_weightage if parent_weightage > 0 else category_weightage
    if effective_parent_weightage == 0:
        effective_parent_weightage = module_weightage  # Use module's own weightage as fallback
    
    for result in results:
        # Convert numpy types in result
        result = convert_numpy_types(result)
        score = float(result.get("score", 0))
        weightage = float(result.get("weightage", 0))
        gap = calculate_score_gap(score, weightage)
        total_score_gap += gap
        
        # Calculate nested contribution for this result
        result_nested_contribution = calculate_nested_contribution(
            score, weightage, module_weightage, effective_parent_weightage
        )
        
        priority = result.get("priority", "LOW")
        actions = result.get("actions", [])
        
        if priority == "CRITICAL":
            critical_issues.append({
                "rule": result.get("name", ""),
                "score_gap": float(round(gap, 2)),
                "section_score": float(round(score, 2)),
                "section_weightage": float(round(weightage, 2)),
                "contribution_to_overall_score": float(result_nested_contribution["actual_contribution_to_overall"]),
                "max_contribution_to_overall_score": float(result_nested_contribution["max_contribution_to_overall"]),
                "contribution_percentage": float(result_nested_contribution["contribution_percentage"]),
                "max_contribution_percentage": float(result_nested_contribution["max_contribution_percentage"]),
                "contribution_gap": float(result_nested_contribution["contribution_gap"]),
                "contribution_gap_percentage": float(result_nested_contribution["contribution_gap_percentage"]),
                "actions": [a.get("action") for a in actions[:2]]  # Top 2 actions
            })
        
        if priority in ["CRITICAL", "HIGH"]:
            high_priority_actions.extend(actions[:1])  # Top action from each
        
        # Quick wins: Low effort, high impact (score gap > 1)
        if gap > 1 and priority in ["MEDIUM", "LOW"]:
            quick_wins.append({
                "rule": result.get("name", ""),
                "score_gap": float(round(gap, 2)),
                "section_score": float(round(score, 2)),
                "section_weightage": float(round(weightage, 2)),
                "contribution_to_overall_score": float(result_nested_contribution["actual_contribution_to_overall"]),
                "max_contribution_to_overall_score": float(result_nested_contribution["max_contribution_to_overall"]),
                "contribution_percentage": float(result_nested_contribution["contribution_percentage"]),
                "contribution_gap": float(result_nested_contribution["contribution_gap"]),
                "action": actions[0].get("action") if actions else "Review and improve"
            })
    
    return {
        "total_score_gap": float(round(total_score_gap, 2)),
        "contribution_to_overall_score": float(round(module_actual_contribution, 4)),
        "max_contribution_to_overall_score": float(round(module_max_contribution, 4)),
        "module_score": float(round(module_score, 2)),
        "module_weightage": float(round(module_weightage, 2)),
        "contribution_percentage": float(round((module_actual_contribution / 100) * 100, 4)),
        "max_contribution_percentage": float(round((module_max_contribution / 100) * 100, 4)),
        "critical_issues": critical_issues[:5],  # Top 5 critical issues
        "high_priority_actions": high_priority_actions[:10],  # Top 10 actions
        "quick_wins": quick_wins[:5]  # Top 5 quick wins
    }


def calculate_nested_contribution(score: float, weightage: float, parent_weightage: float, 
                                   category_weightage: float, max_total_score: float = 100) -> Dict:
    """
    Calculate the actual contribution of a nested rule to the overall score (out of 100).
    
    Example: Secondary Radar Guage (score: 2.14, weightage: 2.14) 
             within Safety_Interlocks (weightage: 30)
             within TAS (weightage: 20)
             
             Safety_Interlocks max contribution to overall = (30 / 100) * 20 = 6 points
             Secondary Radar Guage max contribution = (2.14 / 30) * 6 = 0.428 points
             Actual contribution = (score / weightage) * max_contribution
             
             If score = 2.14 (full score), actual = 0.428 points
             If score = 0.64 (partial), actual = (0.64 / 2.14) * 0.428 = 0.128 points
    
    Args:
        score: Current score achieved by the rule
        weightage: Rule's weightage (within parent)
        parent_weightage: Parent module's weightage (e.g., Safety_Interlocks = 30)
        category_weightage: Category's weightage (e.g., TAS = 20)
        max_total_score: Maximum total score (default 100)
    
    Returns:
        Dictionary with contribution details
    """
    # Calculate max possible contribution to overall score
    # Step 1: Parent's max contribution = (parent_weightage / 100) * category_weightage
    # Step 2: Rule's max contribution = (rule_weightage / parent_weightage) * parent_max_contribution
    # Simplified: (rule_weightage / 100) * category_weightage
    
    if parent_weightage > 0:
        parent_max_contribution = (parent_weightage / 100) * category_weightage
        max_contribution = (weightage / parent_weightage) * parent_max_contribution
    else:
        # Direct child of category
        max_contribution = (weightage / 100) * category_weightage
    
    # Calculate actual contribution based on score achieved
    # Formula: (score / weightage) * max_contribution
    actual_contribution = (score / weightage) * max_contribution if weightage > 0 else 0
    
    # Calculate max possible score gap contribution
    max_gap_contribution = max_contribution - actual_contribution
    
    return {
        "max_contribution_to_overall": float(round(max_contribution, 2)),
        "actual_contribution_to_overall": float(round(actual_contribution, 2)),
        "contribution_percentage": float(round((actual_contribution / max_total_score) * 100, 2)),
        "max_contribution_percentage": float(round((max_contribution / max_total_score) * 100, 2)),
        "contribution_gap": float(round(max_gap_contribution, 2)),
        "contribution_gap_percentage": float(round((max_gap_contribution / max_total_score) * 100, 2))
    }


def extract_results_from_category(category: Dict) -> List[Dict]:
    """Recursively extract all result items from a category (handles nested results)."""
    results = []
    # Convert numpy types in category
    category = convert_numpy_types(category)
    category_weightage = float(category.get("weightage", 0))
    
    # Get direct results
    direct_results = category.get("results", [])
    for result in direct_results:
        # Convert numpy types in result
        result = convert_numpy_types(result)
        # Check if this result has nested results (like TAS module)
        if "results" in result and isinstance(result["results"], list):
            # This is a parent module with nested results (e.g., TAS > Safety_Interlocks)
            parent_weightage = float(result.get("weightage", 0))
            for nested_result in result["results"]:
                # Convert numpy types in nested_result
                nested_result = convert_numpy_types(nested_result)
                nested_result["parent_module"] = category.get("name", "")
                nested_result["parent_result"] = result.get("name", "")
                nested_result["parent_weightage"] = float(parent_weightage)
                nested_result["category_weightage"] = float(category_weightage)
                results.append(nested_result)
        else:
            # Regular result (direct child of category)
            result["parent_module"] = category.get("name", "")
            result["parent_result"] = None
            result["parent_weightage"] = float(0)  # No parent, so use category weightage directly
            result["category_weightage"] = float(category_weightage)
            results.append(result)
    
    return results


def generate_overall_insights(performance_score: Dict) -> Dict:
    """
    Generate overall insights for the entire performance score.
    
    Args:
        performance_score: Complete performance score dictionary with 'category' list
    
    Returns:
        Overall insights dictionary
    """
    # Convert numpy types in performance_score before processing
    performance_score = convert_numpy_types(performance_score)
    
    categories = performance_score.get("category", [])
    total_score = float(performance_score.get("score", 0))
    max_possible = 100
    
    overall_gap = calculate_score_gap(total_score, max_possible)
    
    # Store module weightages for calculating global impact
    module_weightages = {}
    for category in categories:
        module_weightages[category.get("name", "")] = category.get("weightage", 0)
    
    # Collect all results from all categories (including nested ones)
    all_results = []
    module_gaps = []
    
    for category in categories:
        # Convert numpy types in category
        category = convert_numpy_types(category)
        category_name = category.get("name", "")
        category_score = float(category.get("score", 0))
        category_weightage = float(category.get("weightage", 0))
        category_gap = calculate_score_gap(category_score, category_weightage)
        
        module_gaps.append({
            "module": category_name,
            "score": float(round(category_score, 2)),
            "weightage": float(round(category_weightage, 2)),
            "gap": float(round(category_gap, 2)),
            "contribution_to_overall_score": float(round(category_score, 2)),  # Actual contribution to overall score (out of 100)
            "contribution_percentage": float(round((category_score / max_possible) * 100, 2)),  # Percentage of total score
            "priority": get_priority_level(category_gap, category_weightage)
        })
        
        # Extract all results from this category
        category_results = extract_results_from_category(category)
        all_results.extend(category_results)
    
    # Sort modules by gap (highest first)
    module_gaps.sort(key=lambda x: x["gap"], reverse=True)
    
    # Collect critical issues and actions from all results
    all_critical = []
    all_high_priority_actions = []
    all_medium_priority_actions = []
    
    for result in all_results:
        # Convert numpy types in result
        result = convert_numpy_types(result)
        score = float(result.get("score", 0))
        weightage = float(result.get("weightage", 0))
        gap = calculate_score_gap(score, weightage)
        
        # Skip if no weightage (invalid result)
        if weightage == 0:
            continue
        
        # Calculate nested contribution to overall score
        parent_weightage = float(result.get("parent_weightage", 0))
        category_weightage = float(result.get("category_weightage", 0))
        
        # If parent_weightage is 0, it means this is a direct child of category
        # In that case, use category_weightage as the parent
        if parent_weightage == 0:
            parent_weightage = category_weightage
        
        nested_contribution = calculate_nested_contribution(
            score, weightage, parent_weightage, category_weightage, max_possible
        )
        
        priority = result.get("priority")
        
        # If priority not set, calculate it
        if not priority:
            priority = get_priority_level(gap, weightage)
            result["priority"] = priority  # Set it for later use
        
        # If result doesn't have insights, enhance it now
        if "reason" not in result or "actions" not in result:
            # Try to determine module type from context
            module_type = "general"
            rule_name = result.get("name", "").lower()
            parent_result_name = f"{result['parent_result']}".lower() if result.get("parent_result") else ""
            
            if "alert" in rule_name or "alert" in parent_result_name:
                module_type = "open_alerts"
            elif "rejection" in rule_name:
                module_type = "percentage_rejection"
            elif "va" in rule_name or "va" in parent_result_name:
                module_type = "va_portal" if "portal" in rule_name else "va_alerts"
            elif "vts" in rule_name or "vts" in parent_result_name:
                module_type = "vts"
            elif "water" in rule_name:
                module_type = "water_quantity"
            elif "foam" in rule_name:
                module_type = "foam_quantity"
            elif "fire" in rule_name:
                module_type = "fire_engines_auto_mode"
            elif "hydrant" in rule_name or "jockey" in rule_name:
                module_type = "hydrant_line"
            elif "emlock" in rule_name:
                module_type = "emlock"
            elif "dryout" in rule_name or "carry" in rule_name:
                module_type = "dryout"
            elif "safety" in parent_result_name:
                module_type = "safety_interlocks"
            elif "gantry" in parent_result_name:
                module_type = "gantry_interlocks"
            elif "process" in parent_result_name:
                module_type = "process_interlocks"
            
            # Enhance result with insights
            result = enhance_result_with_insights(result, module_type)
        
        # Collect critical issues
        if priority == "CRITICAL" and gap > 0:
            rule_name = result.get("name", "")
            parent_module = result.get("parent_module", "")
            parent_result = result.get("parent_result", "")
            
            # Build full name
            if parent_result:
                full_name = f"{parent_module} > {parent_result} > {rule_name}"
            else:
                full_name = f"{parent_module} > {rule_name}" if parent_module else rule_name
            
            reason_obj = result.get("reason", {})
            all_critical.append({
                "rule": full_name,
                "module": parent_module or result.get("module", ""),
                "score_gap": float(round(gap, 2)),
                "current_score": float(round(score, 2)),
                "max_score": float(round(weightage, 2)),
                "section_score": float(round(score, 2)),  # Score within its section
                "section_weightage": float(round(weightage, 2)),  # Weightage within its section
                "contribution_to_overall_score": float(nested_contribution["actual_contribution_to_overall"]),  # Actual contribution to overall score (out of 100)
                "max_contribution_to_overall_score": float(nested_contribution["max_contribution_to_overall"]),  # Max possible contribution
                "contribution_percentage": float(nested_contribution["contribution_percentage"]),  # Percentage of total score (actual)
                "max_contribution_percentage": float(nested_contribution["max_contribution_percentage"]),  # Max percentage possible
                "contribution_gap": float(nested_contribution["contribution_gap"]),  # Gap in contribution to overall score
                "contribution_gap_percentage": float(nested_contribution["contribution_gap_percentage"]),  # Gap as percentage of total
                "percentage_achieved": float(reason_obj.get("percentage_achieved", round((score/weightage*100), 2))),
                "explanation": result.get("msg", reason_obj.get("explanation", f"Score is {float(round(score, 2))} out of {float(round(weightage, 2))}")),
                "actions": [a.get("action") for a in result.get("actions", [])[:2]]  # Top 2 actions
            })
        
        # Collect high priority actions
        if priority in ["CRITICAL", "HIGH"] and gap > 0:
            actions = result.get("actions", [])
            # Filter out actions that don't make sense (e.g., "0 vehicles have alerts")
            valid_actions = []
            for action in actions:
                description = action.get("description", "")
                # Skip actions that mention "0" alerts/devices/vehicles in a way that doesn't make sense
                if "0 " in description and ("vehicles have active" in description or "devices have active" in description):
                    # Check if this is actually a valid case (score gap exists but no alerts)
                    if "configuration" in description.lower() or "calculation" in description.lower():
                        valid_actions.append(action)
                    # Otherwise skip it
                else:
                    valid_actions.append(action)
            
            if valid_actions:
                for action in valid_actions[:2]:  # Top 2 actions per result
                    action_priority = action.get("priority", priority)
                    if action_priority in ["CRITICAL", "HIGH"]:
                        action_copy = action.copy()
                        action_copy["module"] = result.get("parent_module", result.get("module", ""))
                        action_copy["rule"] = result.get("name", "")
                        # score_gap is already the global impact (rule weightage is part of module weightage which is part of total 100)
                        action_copy["score_gap"] = float(round(gap, 2))
                        action_copy["global_impact"] = float(round(gap, 2))  # Same value, but clearer naming
                        action_copy["global_impact_percentage"] = float(round((gap / 100) * 100, 2))  # Percentage of total score
                        # Add contribution fields
                        action_copy["contribution_to_overall_score"] = float(nested_contribution["actual_contribution_to_overall"])
                        action_copy["contribution_gap"] = float(nested_contribution["contribution_gap"])
                        action_copy["overall_gap"] = float(round(overall_gap, 2))
                        # Update impact text to clarify it's global impact
                        if "impact" in action_copy:
                            if "points" in action_copy["impact"] and "overall score" not in action_copy["impact"]:
                                action_copy["impact"] = action_copy["impact"].replace("points", "points on overall score")
                            # Add percentage if not already present
                            if "%" not in action_copy["impact"] and gap > 0:
                                pct = float(round((gap / 100) * 100, 2))
                                action_copy["impact"] += f" ({pct}% of total score)"
                        all_high_priority_actions.append(action_copy)
            else:
                # Generate default action if none exists
                global_impact_pct = float(round((gap / 100) * 100, 2) if gap > 0 else 0)
                default_action = {
                    "action": f"Review and improve {result.get('name', 'rule')} performance",
                    "priority": priority,
                    "description": f"Current score is {float(round(score, 2))} out of {float(round(weightage, 2))}. Review metrics and identify improvement areas.",
                    "impact": f"Can recover up to {float(round(gap, 2))} points on overall score ({global_impact_pct}% of total score)",
                    "module": result.get("parent_module", result.get("module", "")),
                    "rule": result.get("name", ""),
                    "score_gap": float(round(gap, 2)),
                    "global_impact": float(round(gap, 2)),
                    "global_impact_percentage": global_impact_pct,
                    "contribution_to_overall_score": float(nested_contribution["actual_contribution_to_overall"]),
                    "contribution_gap": float(nested_contribution["contribution_gap"]),
                    "overall_gap": float(round(overall_gap, 2))
                }
                all_high_priority_actions.append(default_action)
        
        # Collect medium priority actions for quick wins
        if priority == "MEDIUM" and gap > 1:
            actions = result.get("actions", [])
            if actions:
                action_copy = actions[0].copy()
                action_copy["module"] = result.get("parent_module", result.get("module", ""))
                action_copy["rule"] = result.get("name", "")
                action_copy["score_gap"] = float(round(gap, 2))
                all_medium_priority_actions.append(action_copy)
    
    # Sort critical issues by score gap
    all_critical.sort(key=lambda x: x["score_gap"], reverse=True)
    
    # Sort actions by priority and score gap
    def action_sort_key(action):
        priority_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
        return (priority_order.get(action.get("priority", "LOW"), 99), -action.get("score_gap", 0))
    
    all_high_priority_actions.sort(key=action_sort_key)
    
    # Generate detailed focus areas
    focus_areas = []
    for mg in module_gaps[:3]:  # Top 3 modules
        module_name = mg["module"]
        module_gap = mg["gap"]
        
        # Find top results in this module
        module_results = [r for r in all_results if r.get("parent_module") == module_name or r.get("module") == module_name]
        module_results.sort(key=lambda x: calculate_score_gap(float(x.get("score", 0)), float(x.get("weightage", 0))), reverse=True)
        
        top_issues = []
        for result in module_results[:5]:  # Top 5 issues in this module
            # Convert numpy types in result
            result = convert_numpy_types(result)
            result_gap = calculate_score_gap(float(result.get("score", 0)), float(result.get("weightage", 0)))
            if result_gap > 0:
                # Ensure result has insights
                if "reason" not in result or "actions" not in result:
                    module_type = "general"
                    rule_name = result.get("name", "").lower()
                    if "alert" in rule_name:
                        module_type = "open_alerts"
                    elif "rejection" in rule_name:
                        module_type = "percentage_rejection"
                    elif "va" in rule_name:
                        module_type = "va_portal"
                    elif "vts" in rule_name:
                        module_type = "vts"
                    result = enhance_result_with_insights(result, module_type)
                
                result_score = float(result.get("score", 0))
                # Calculate nested contribution for this result
                result_parent_weightage = float(result.get("parent_weightage", 0))
                result_category_weightage = float(result.get("category_weightage", 0))
                if result_parent_weightage == 0:
                    result_parent_weightage = result_category_weightage
                
                result_nested_contribution = calculate_nested_contribution(
                    result_score, result.get("weightage", 0), result_parent_weightage, 
                    result_category_weightage, max_possible
                )
                
                top_issues.append({
                    "rule": result.get("name", ""),
                    "score_gap": float(round(result_gap, 2)),
                    "current_score": float(round(result_score, 2)),
                    "max_score": float(round(result.get("weightage", 0), 2)),
                    "section_score": float(round(result_score, 2)),  # Score within its section
                    "section_weightage": float(round(result.get("weightage", 0), 2)),  # Weightage within its section
                    "contribution_to_overall_score": float(result_nested_contribution["actual_contribution_to_overall"]),  # Actual contribution to overall score (out of 100)
                    "max_contribution_to_overall_score": float(result_nested_contribution["max_contribution_to_overall"]),  # Max possible contribution
                    "contribution_percentage": float(result_nested_contribution["contribution_percentage"]),  # Percentage of total score (actual)
                    "max_contribution_percentage": float(result_nested_contribution["max_contribution_percentage"]),  # Max percentage possible
                    "contribution_gap": float(result_nested_contribution["contribution_gap"]),  # Gap in contribution to overall score
                    "contribution_gap_percentage": float(result_nested_contribution["contribution_gap_percentage"]),  # Gap as percentage of total
                    "priority": result.get("priority", get_priority_level(result_gap, result.get("weightage", 0))),
                    "explanation": result.get("msg", result.get("reason", {}).get("explanation", "")),
                    "top_action": result.get("actions", [{}])[0].get("action", "") if result.get("actions") else "",
                    "action_impact": result.get("actions", [{}])[0].get("impact", "") if result.get("actions") else ""
                })
        
        # Get immediate actions from top issues
        immediate_actions = []
        for issue in top_issues[:3]:  # Top 3 issues
            # Find the result to get full action details
            matching_result = next((r for r in module_results if r.get("name") == issue["rule"]), None)
            if matching_result and matching_result.get("actions"):
                for action in matching_result["actions"][:1]:  # Top action from each issue
                    immediate_actions.append({
                        "rule": issue["rule"],
                        "action": action.get("action", ""),
                        "priority": action.get("priority", issue["priority"]),
                        "impact": action.get("impact", ""),
                        "description": action.get("description", "")
                    })
        
        focus_areas.append({
            "module": module_name,
            "module_gap": float(round(module_gap, 2)),
            "module_priority": mg["priority"],
            "module_score": float(round(mg["score"], 2)),
            "module_weightage": float(round(mg["weightage"], 2)),
            "contribution_to_overall_score": float(round(mg["score"], 2)),  # Actual contribution to overall score (out of 100)
            "contribution_percentage": float(round((mg["score"] / max_possible) * 100, 2)),  # Percentage of total score
            "reason": f"Score gap of {float(round(module_gap, 2))} points ({mg['priority']} priority) - {float(round((module_gap/max_possible)*100, 2))}% of total score. Current: {float(round(mg['score'], 2))}/{float(round(mg['weightage'], 2))}. Contributes {float(round(mg['score'], 2))} points to overall score ({float(round((mg['score']/max_possible)*100, 2))}%).",
            "potential_impact": f"Can improve overall score by {float(round((module_gap/max_possible)*100, 2))}%",
            "key_issues": top_issues,
            "immediate_actions": immediate_actions[:5],  # Top 5 immediate actions
            "summary": f"Focus on {len(top_issues)} key issues in {module_name} module. Currently contributes {float(round(mg['score'], 2))} points ({float(round((mg['score']/max_possible)*100, 2))}%) to overall score. Priority actions include: {', '.join([a['action'] for a in immediate_actions[:3]])}"
        })
    
    # Update module-level insights with parent weightage information
    # This ensures nested modules (like Safety_Interlocks within TAS) have correct contribution calculations
    for category in categories:
        category = convert_numpy_types(category)
        category_weightage = float(category.get("weightage", 0))
        category_results = category.get("results", [])
        
        for module_result in category_results:
            # Convert numpy types in module_result
            module_result = convert_numpy_types(module_result)
            # Check if this module has nested results (like TAS > Safety_Interlocks)
            if "results" in module_result and isinstance(module_result.get("results"), list):
                module_name = module_result.get("name", "")
                module_score = float(module_result.get("score", 0))
                module_weightage = float(module_result.get("weightage", 0))
                
                # Calculate module's contribution to overall score
                module_max_contribution = (module_weightage / 100) * category_weightage
                module_actual_contribution = (module_score / module_weightage) * module_max_contribution if module_weightage > 0 else 0
                
                # Update module insights if they exist
                if "insights" in module_result:
                    insights = module_result["insights"]
                    # Update with correct contribution values
                    insights["contribution_to_overall_score"] = float(round(module_actual_contribution, 4))
                    insights["max_contribution_to_overall_score"] = float(round(module_max_contribution, 4))
                    insights["contribution_percentage"] = float(round((module_actual_contribution / max_possible) * 100, 4))
                    insights["max_contribution_percentage"] = float(round((module_max_contribution / max_possible) * 100, 4))
                    
                    # Update critical_issues and quick_wins with nested contributions
                    for issue in insights.get("critical_issues", []):
                        rule_name = issue.get("rule", "")
                        # Find the corresponding result to get nested contribution
                        matching_result = next(
                            (r for r in module_result.get("results", []) if r.get("name") == rule_name),
                            None
                        )
                        if matching_result:
                            rule_score = matching_result.get("score", 0)
                            rule_weightage = matching_result.get("weightage", 0)
                            rule_nested_contribution = calculate_nested_contribution(
                                rule_score, rule_weightage, module_weightage, category_weightage, max_possible
                            )
                            issue["contribution_to_overall_score"] = float(rule_nested_contribution["actual_contribution_to_overall"])
                            issue["max_contribution_to_overall_score"] = float(rule_nested_contribution["max_contribution_to_overall"])
                            issue["contribution_percentage"] = float(rule_nested_contribution["contribution_percentage"])
                            issue["max_contribution_percentage"] = float(rule_nested_contribution["max_contribution_percentage"])
                            issue["contribution_gap"] = float(rule_nested_contribution["contribution_gap"])
                            issue["contribution_gap_percentage"] = float(rule_nested_contribution["contribution_gap_percentage"])
                            issue["section_score"] = float(round(rule_score, 2))
                            issue["section_weightage"] = float(round(rule_weightage, 2))
                    
                    for quick_win in insights.get("quick_wins", []):
                        rule_name = quick_win.get("rule", "")
                        matching_result = next(
                            (r for r in module_result.get("results", []) if r.get("name") == rule_name),
                            None
                        )
                        if matching_result:
                            matching_result = convert_numpy_types(matching_result)
                            rule_score = float(matching_result.get("score", 0))
                            rule_weightage = float(matching_result.get("weightage", 0))
                            rule_nested_contribution = calculate_nested_contribution(
                                rule_score, rule_weightage, module_weightage, category_weightage, max_possible
                            )
                            quick_win["contribution_to_overall_score"] = float(rule_nested_contribution["actual_contribution_to_overall"])
                            quick_win["max_contribution_to_overall_score"] = float(rule_nested_contribution["max_contribution_to_overall"])
                            quick_win["contribution_percentage"] = float(rule_nested_contribution["contribution_percentage"])
                            quick_win["contribution_gap"] = float(rule_nested_contribution["contribution_gap"])
                            quick_win["section_score"] = float(round(rule_score, 2))
                            quick_win["section_weightage"] = float(round(rule_weightage, 2))
                
                # Also regenerate insights with parent weightage if not already done
                elif module_result.get("results"):
                    module_result["insights"] = generate_summary_insights(
                        module_result, 
                        parent_weightage=category_weightage,
                        category_weightage=category_weightage
                    )
    
    return {
        "overall_score": float(round(total_score, 2)),
        "overall_gap": float(round(overall_gap, 2)),
        "improvement_potential": float(round((overall_gap / max_possible) * 100, 2)),
        "top_priority_modules": module_gaps[:5],  # Top 5 modules with highest gaps
        "critical_issues": all_critical[:10],  # Top 10 critical issues across all modules
        "recommended_actions": all_high_priority_actions[:20],  # Top 20 recommended actions
        "quick_wins": all_medium_priority_actions[:10],  # Top 10 quick wins
        "focus_areas": focus_areas  # Top 3 focus areas with detailed breakdown
    }
