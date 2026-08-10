# Priority Action Center: JSON to UI Mapping Guide

This document explains how to transform the performance score JSON `recommended_actions` array into the Priority Action Center UI format shown in the image.

## JSON Structure

The performance score JSON contains an `insights` object with a `recommended_actions` array:

```json
{
  "insights": {
    "recommended_actions": [
      {
        "action": "Switch fire engines to auto mode",
        "priority": "CRITICAL",
        "description": "Fire engines are currently in manual override...",
        "module": "TAS",
        "rule": "Fire Engines in Auto Mode",
        "score_gap": 10.0,
        "contribution_to_overall_score": 0.0,
        "contribution_gap": 15.0,
        "overall_gap": 33.0,
        "impact": "Can recover up to 15.0 points on overall score",
        "global_impact": 15.0,
        "global_impact_percentage": 15.0
      }
    ]
  }
}
```

## UI Component Mapping

### Card Structure

Each action card in the Priority Action Center should be rendered from a `recommended_actions` item with the following mappings:

| UI Element | JSON Field | Transformation Logic |
|------------|------------|---------------------|
| **Priority Tag** | `priority` | Map to display text:<br>- `"CRITICAL"` → `"CRITICAL"`<br>- `"HIGH"` → `"HIGH IMPACT"`<br>- `"MEDIUM"` → `"MEDIUM IMPACT"`<br>- `"LOW"` → `"LOW IMPACT"` |
| **Left Border Color** | `priority` | Color mapping:<br>- `"CRITICAL"` → `#DC2626` (red)<br>- `"HIGH"` → `#F97316` (orange)<br>- `"MEDIUM"` → `#F59E0B` (amber)<br>- `"LOW"` → `#10B981` (green) |
| **Icon** | `module` + `priority` | Icon selection based on module:<br>- `"TAS"` / `"SAFETY"` → Fire/Shield icon<br>- `"VA"` → Key/Portal icon<br>- `"VTS"` → Truck/Vehicle icon<br>- `"LPG"` → Gas/Flame icon<br>- Default → Alert icon |
| **Module Name** | `module` | Format: `{module} MODULE`<br>Example: `"TAS"` → `"SAFETY MODULE"` |
| **Action Title** | `action` | Use directly from JSON |
| **Description** | `description` | Use directly from JSON |
| **Potential Impact** | `contribution_gap` or `score_gap` | Format: `"Potential +{value} OI"`<br>Use `contribution_gap` if available, else `score_gap`<br>Example: `15.0` → `"Potential +15.0 OI"` |
| **Action Button Text** | `action` + `module` | Generate based on action type:<br>- Fire engines → `"Take Action"`<br>- Portal issues → `"Update Portal"`<br>- VTS/Tracking → `"Review Log"`<br>- Default → `"Take Action"` |
| **Action Button Color** | `priority` | Button styling:<br>- `"CRITICAL"` → Dark blue (`#1E40AF`)<br>- `"HIGH"` → Medium blue (`#3B82F6`)<br>- `"MEDIUM"` / `"LOW"` → Light grey (`#E5E7EB`) |

## Example Transformation

### Input JSON

```json
{
  "insights": {
    "recommended_actions": [
      {
        "action": "Switch fire engines to auto mode",
        "priority": "CRITICAL",
        "description": "Fire engines are currently in manual override. System compliance requires auto-start readiness.",
        "module": "TAS",
        "rule": "Fire Engines in Auto Mode",
        "score_gap": 10.0,
        "contribution_to_overall_score": 0.0,
        "contribution_gap": 15.0,
        "overall_gap": 33.0,
        "impact": "Can recover up to 15.0 points on overall score (15.0% of total score)",
        "global_impact": 15.0,
        "global_impact_percentage": 15.0
      },
      {
        "action": "Resolve VA Portal Inactivity",
        "priority": "CRITICAL",
        "description": "No data sync detected from VA Portal in the last 72 hours. Score is currently 0/90.",
        "module": "VA",
        "rule": "VA Portal",
        "score_gap": 18.0,
        "contribution_to_overall_score": 0.0,
        "contribution_gap": 18.0,
        "overall_gap": 33.0,
        "impact": "Can recover up to 18.0 points on overall score (18.0% of total score)",
        "global_impact": 18.0,
        "global_impact_percentage": 18.0
      },
      {
        "action": "Improve Tracking Compliance",
        "priority": "HIGH",
        "description": "12% of vehicles arriving have non-functional VTS transponders.",
        "module": "VTS",
        "rule": "Active Vehicles",
        "score_gap": 5.4,
        "contribution_to_overall_score": 8.95,
        "contribution_gap": 5.4,
        "overall_gap": 33.0,
        "impact": "Can recover up to 5.4 points on overall score (5.4% of total score)",
        "global_impact": 5.4,
        "global_impact_percentage": 5.4
      }
    ]
  }
}
```

### Output UI Data Structure

```typescript
interface ActionCard {
  id: string;
  priority: "CRITICAL" | "HIGH IMPACT" | "MEDIUM IMPACT" | "LOW IMPACT";
  priorityColor: string;
  borderColor: string;
  icon: string;
  iconColor: string;
  module: string;
  actionTitle: string;
  description: string;
  potentialImpact: string;
  potentialImpactValue: number;
  buttonText: string;
  buttonColor: string;
  buttonTextColor: string;
  contributionToOverallScore: number;
  contributionGap: number;
  overallGap: number;
  scoreGap: number;
}

// Transformed data
const actionCards: ActionCard[] = [
  {
    id: "fire-engines-auto",
    priority: "CRITICAL",
    priorityColor: "#DC2626",
    borderColor: "#DC2626",
    icon: "fire-alarm", // or icon component name
    iconColor: "#DC2626",
    module: "SAFETY MODULE",
    actionTitle: "Switch fire engines to auto mode",
    description: "Fire engines are currently in manual override. System compliance requires auto-start readiness.",
    potentialImpact: "Potential +15.0 OI",
    potentialImpactValue: 15.0,
    buttonText: "Take Action",
    buttonColor: "#1E40AF",
    buttonTextColor: "#FFFFFF",
    contributionToOverallScore: 0.0,
    contributionGap: 15.0,
    overallGap: 33.0,
    scoreGap: 10.0
  },
  {
    id: "va-portal-inactivity",
    priority: "CRITICAL",
    priorityColor: "#DC2626",
    borderColor: "#DC2626",
    icon: "key", // or icon component name
    iconColor: "#DC2626",
    module: "VA MODULE",
    actionTitle: "Resolve VA Portal Inactivity",
    description: "No data sync detected from VA Portal in the last 72 hours. Score is currently 0/90.",
    potentialImpact: "Potential +18.0 OI",
    potentialImpactValue: 18.0,
    buttonText: "Update Portal",
    buttonColor: "#1E40AF",
    buttonTextColor: "#FFFFFF",
    contributionToOverallScore: 0.0,
    contributionGap: 18.0,
    overallGap: 33.0,
    scoreGap: 18.0
  },
  {
    id: "tracking-compliance",
    priority: "HIGH IMPACT",
    priorityColor: "#F97316",
    borderColor: "#F97316",
    icon: "truck", // or icon component name
    iconColor: "#F97316",
    module: "VTS MODULE",
    actionTitle: "Improve Tracking Compliance",
    description: "12% of vehicles arriving have non-functional VTS transponders.",
    potentialImpact: "Potential +5.4 OI",
    potentialImpactValue: 5.4,
    buttonText: "Review Log",
    buttonColor: "#E5E7EB",
    buttonTextColor: "#374151",
    contributionToOverallScore: 8.95,
    contributionGap: 5.4,
    overallGap: 33.0,
    scoreGap: 5.4
  }
];
```

## React Component Example

```typescript
import React from 'react';

interface RecommendedAction {
  action: string;
  priority: string;
  description: string;
  module: string;
  rule: string;
  score_gap: number;
  contribution_to_overall_score: number;
  contribution_gap: number;
  overall_gap: number;
  impact: string;
  global_impact: number;
  global_impact_percentage: number;
}

interface ActionCardProps {
  action: RecommendedAction;
  index: number;
}

const ActionCard: React.FC<ActionCardProps> = ({ action, index }) => {
  // Priority mapping
  const priorityMap: Record<string, { label: string; color: string }> = {
    CRITICAL: { label: "CRITICAL", color: "#DC2626" },
    HIGH: { label: "HIGH IMPACT", color: "#F97316" },
    MEDIUM: { label: "MEDIUM IMPACT", color: "#F59E0B" },
    LOW: { label: "LOW IMPACT", color: "#10B981" }
  };

  // Icon mapping
  const iconMap: Record<string, string> = {
    TAS: "fire-alarm",
    SAFETY: "fire-alarm",
    VA: "key",
    VTS: "truck",
    LPG: "flame"
  };

  // Button text mapping
  const getButtonText = (action: string, module: string): string => {
    const lowerAction = action.toLowerCase();
    if (lowerAction.includes("portal")) return "Update Portal";
    if (lowerAction.includes("tracking") || lowerAction.includes("vehicle") || lowerAction.includes("vts")) return "Review Log";
    if (lowerAction.includes("fire") || lowerAction.includes("engine")) return "Take Action";
    return "Take Action";
  };

  // Button color mapping
  const getButtonColor = (priority: string): { bg: string; text: string } => {
    if (priority === "CRITICAL") return { bg: "#1E40AF", text: "#FFFFFF" };
    if (priority === "HIGH") return { bg: "#3B82F6", text: "#FFFFFF" };
    return { bg: "#E5E7EB", text: "#374151" };
  };

  const priority = priorityMap[action.priority] || priorityMap.MEDIUM;
  const icon = iconMap[action.module] || "alert";
  const buttonText = getButtonText(action.action, action.module);
  const buttonColors = getButtonColor(action.priority);
  const potentialImpact = action.contribution_gap || action.score_gap;
  const moduleName = `${action.module} MODULE`;

  return (
    <div
      className="action-card"
      style={{
        borderLeft: `4px solid ${priority.color}`,
        backgroundColor: "#F9FAFB",
        borderRadius: "8px",
        padding: "16px",
        marginBottom: "16px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {/* Left Section */}
        <div style={{ display: "flex", gap: "12px", flex: 1 }}>
          {/* Icon */}
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "8px",
              backgroundColor: `${priority.color}20`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <span style={{ fontSize: "24px" }}>{/* Icon component */}</span>
          </div>

          {/* Content */}
          <div style={{ flex: 1 }}>
            {/* Priority Tag and Module */}
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
              <span
                style={{
                  backgroundColor: priority.color,
                  color: "#FFFFFF",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontWeight: "600"
                }}
              >
                {priority.label}
              </span>
              <span style={{ fontSize: "12px", color: "#6B7280", fontWeight: "500" }}>
                {moduleName}
              </span>
            </div>

            {/* Action Title */}
            <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "4px", color: "#111827" }}>
              {action.action}
            </h3>

            {/* Description */}
            <p style={{ fontSize: "14px", color: "#6B7280", marginBottom: "0" }}>
              {action.description}
            </p>
          </div>
        </div>

        {/* Right Section */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "12px" }}>
          {/* Potential Impact */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ color: "#10B981", fontSize: "14px" }}>+</span>
            <span style={{ color: "#10B981", fontSize: "16px", fontWeight: "600" }}>
              Potential +{potentialImpact.toFixed(1)} OI
            </span>
          </div>

          {/* Action Button */}
          <button
            style={{
              backgroundColor: buttonColors.bg,
              color: buttonColors.text,
              border: "none",
              borderRadius: "6px",
              padding: "8px 16px",
              fontSize: "14px",
              fontWeight: "500",
              cursor: "pointer"
            }}
            onClick={() => {
              // Handle action click
              console.log("Action clicked:", action);
            }}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
};

// Main Component
interface PriorityActionCenterProps {
  recommendedActions: RecommendedAction[];
}

const PriorityActionCenter: React.FC<PriorityActionCenterProps> = ({ recommendedActions }) => {
  // Sort by priority (CRITICAL first, then by contribution_gap descending)
  const sortedActions = [...recommendedActions].sort((a, b) => {
    const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 99;
    const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 99;
    
    if (aPriority !== bPriority) return aPriority - bPriority;
    return (b.contribution_gap || b.score_gap) - (a.contribution_gap || a.score_gap);
  });

  return (
    <div style={{ padding: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "20px" }}>🚀</span>
          <h2 style={{ fontSize: "20px", fontWeight: "600", color: "#111827" }}>
            Priority Action Center: Score Improvement Roadmap
          </h2>
        </div>
        <a
          href="#"
          style={{ color: "#3B82F6", textDecoration: "none", fontSize: "14px", fontWeight: "500" }}
        >
          View All Tasks →
        </a>
      </div>

      {/* Action Cards */}
      <div>
        {sortedActions.slice(0, 10).map((action, index) => (
          <ActionCard key={`action-${index}`} action={action} index={index} />
        ))}
      </div>
    </div>
  );
};

export default PriorityActionCenter;
```

## Key Transformation Functions

### 1. Priority Label Mapping

```typescript
function getPriorityLabel(priority: string): string {
  const map: Record<string, string> = {
    CRITICAL: "CRITICAL",
    HIGH: "HIGH IMPACT",
    MEDIUM: "MEDIUM IMPACT",
    LOW: "LOW IMPACT"
  };
  return map[priority] || "MEDIUM IMPACT";
}
```

### 2. Priority Color Mapping

```typescript
function getPriorityColor(priority: string): string {
  const map: Record<string, string> = {
    CRITICAL: "#DC2626", // red
    HIGH: "#F97316",     // orange
    MEDIUM: "#F59E0B",   // amber
    LOW: "#10B981"       // green
  };
  return map[priority] || "#F59E0B";
}
```

### 3. Module Name Formatting

```typescript
function formatModuleName(module: string): string {
  // Map module codes to display names
  const moduleMap: Record<string, string> = {
    TAS: "SAFETY",
    VA: "VA",
    VTS: "VTS",
    LPG: "LPG"
  };
  const displayName = moduleMap[module] || module;
  return `${displayName} MODULE`;
}
```

### 4. Icon Selection

```typescript
function getIconForModule(module: string, priority: string): string {
  const iconMap: Record<string, string> = {
    TAS: "fire-alarm",
    SAFETY: "fire-alarm",
    VA: "key",
    VTS: "truck",
    LPG: "flame"
  };
  return iconMap[module] || "alert";
}
```

### 5. Potential Impact Calculation

```typescript
function getPotentialImpact(action: RecommendedAction): string {
  // Prefer contribution_gap as it shows actual impact on overall score
  const impactValue = action.contribution_gap || action.score_gap || 0;
  return `Potential +${impactValue.toFixed(1)} OI`;
}
```

### 6. Button Text Generation

```typescript
function getButtonText(action: string, module: string, rule: string): string {
  const lowerAction = action.toLowerCase();
  const lowerModule = module.toLowerCase();
  const lowerRule = rule.toLowerCase();

  if (lowerAction.includes("portal") || lowerModule === "va") {
    return "Update Portal";
  }
  if (lowerAction.includes("tracking") || lowerAction.includes("vehicle") || 
      lowerModule === "vts" || lowerRule.includes("vts")) {
    return "Review Log";
  }
  if (lowerAction.includes("fire") || lowerAction.includes("engine") || 
      lowerModule === "tas" || lowerRule.includes("fire")) {
    return "Take Action";
  }
  return "Take Action";
}
```

## Sorting Logic

Actions should be sorted by:
1. **Priority** (CRITICAL → HIGH → MEDIUM → LOW)
2. **Contribution Gap** (descending - highest impact first)
3. **Score Gap** (descending - fallback if contribution_gap not available)

```typescript
function sortActions(actions: RecommendedAction[]): RecommendedAction[] {
  return [...actions].sort((a, b) => {
    // Priority order
    const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 99;
    const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 99;
    
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    
    // Then by contribution gap (descending)
    const aGap = a.contribution_gap || a.score_gap || 0;
    const bGap = b.contribution_gap || b.score_gap || 0;
    
    return bGap - aGap;
  });
}
```

## Usage Example

```typescript
// In your component
const performanceScoreData = {
  insights: {
    recommended_actions: [
      // ... actions from API
    ]
  }
};

// Transform and render
const transformedActions = sortActions(performanceScoreData.insights.recommended_actions);

<PriorityActionCenter recommendedActions={transformedActions} />
```

## Notes

1. **Potential Impact**: Use `contribution_gap` as the primary value since it represents the actual impact on the overall score (out of 100). Fall back to `score_gap` if `contribution_gap` is not available.

2. **Module Display**: Format module names consistently (e.g., "SAFETY MODULE", "VA MODULE") for better UX.

3. **Button Actions**: The button text and color should guide users on the type of action needed. Consider adding click handlers that navigate to relevant pages or open modals.

4. **Limiting Display**: Show top 10 actions by default, with "View All Tasks" linking to a full list.

5. **Accessibility**: Ensure proper ARIA labels and keyboard navigation for action cards.

6. **Responsive Design**: Cards should stack vertically on mobile devices and display side-by-side on larger screens.
