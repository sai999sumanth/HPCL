import { WorkflowStep, GroupedSteps } from './dryoutCount';

export const workflowData: WorkflowStep[] = [
  {
      "section": "Indent Not Raised",
      "value": 10,
      "serial": 1,
      "condition": "=",
      "group": "not_raised"
  },
  {
    "section": "Indent Raised",
    "value": 3582,
    "serial": 12,
    "condition": "=",
    "group": "not_raised"
  },
  {
    "section": "Valid \ WIP Indents",
    "value": 640,
    "serial": 13,
    "condition": "=",
    "group": "not_raised"
  },
  {
      "section": "Pending Indents",
      "value": 5,
      "serial": 2,
      "condition": "=",
      "group": "pending"
  },
  {
      "section": "Hold Indents",
      "value": 34,
      "serial": 12,
      "condition": "=",
      "group": "pending"
  },
  {
      "section": " Indents",
      "value": 44,
      "serial": 13,
      "condition": "=",
      "group": "pending"
  },
  {
      "section": "Indent On Hold",
      "value": 6,
      "serial": 3,
      "condition": "=",
      "group": "pending"
  },
  {
      "section": "Truck Allocated",
      "value": 7,
      "serial": 4,
      "condition": "=",
      "group": "wip"
  },
  {
      "section": "Sent to SAP",
      "value": 3,
      "serial": 5,
      "condition": "=",
      "group": "wip"
  },
  {
      "section": "Sales Order Placed",
      "value": 0,
      "serial": 6,
      "condition": "=",
      "group": "wip"
  },
  {
      "section": "R2 Swiped",
      "value":2,
      "serial": 7,
      "condition": "=",
      "group": "wip"
  },
  {
      "section": "Invoice Created",
      "value": 4,
      "serial": 8,
      "condition": "=",
      "group": "wip"
  },
  {
      "section": "R3 Swiped",
      "value": 0,
      "serial": 9,
      "condition": "=",
      "group": "wip"
  },
  {
      "section": "VTS",
      "value": 1,
      "serial": 10,
      "condition": "=",
      "group": "wip"
  },
  {
      "section": "Indent Delivered",
      "value": 0,
      "serial": 11,
      "condition": "=",
      "group": "delivered"
  },
  {
    "section": "Indent Delivered",
    "value": 0,
    "serial": 11,
    "condition": "=",
    "group": "truck_details"
  },
  {
    "section": "Indent Delivered",
    "value": 0,
    "serial": 11,
    "condition": "=",
    "group": "truck_details"
  },
  {
    "section": "Indent Delivered",
    "value": 0,
    "serial": 11,
    "condition": "=",
    "group": "truck_details"
  },
  {
    "section": "Indent Delivered",
    "value": 0,
    "serial": 11,
    "condition": "=",
    "group": "truck_details"
  },
  {
    "section": "Indent Delivered",
    "value": 0,
    "serial": 11,
    "condition": "=",
    "group": "truck_details"
  },
  {
    "section": "Indent Delivered",
    "value": 0,
    "serial": 11,
    "condition": "=",
    "group": "dryout_aging"
  },
  {
    "section": "Indent Delivered",
    "value": 0,
    "serial": 11,
    "condition": "=",
    "group": "dryout_aging"
  },
  {
    "section": "Indent Delivered",
    "value": 0,
    "serial": 11,
    "condition": "=",
    "group": "dryout_aging"
  },
]

export function groupWorkflowSteps(steps: WorkflowStep[]): GroupedSteps[] {
  const groupMap: Record<string, WorkflowStep[]> = {};
  
  steps.forEach(step => {
    if (!groupMap[step.group]) {
      groupMap[step.group] = [];
    }
    groupMap[step.group].push(step);
  });

  return [
    {
      title: "Initial Steps",
      steps: groupMap["not_raised"] || [],
    },
    {
      title: "Pending",
      steps: groupMap["pending"] || [],
    },
    {
      title: "Indent",
      steps: groupMap["indent"] || [],
    },
    // {
    //   title: "Truck Details",
    //   steps: groupMap["truck_details"] || [],
    // },
    {
      title: "TT Available",
      steps: groupMap["tt_available"] || [],
    },
    {
      title: "Dryout Analysis",
      steps: groupMap["dryout_analysis"] || [],
    },    
    {
      title: "Work In Progress",
      steps: groupMap["wip"] || [],
      isWorkInProgress: true
    },
    {
      title: "Delivered",
      steps: groupMap["delivered"] || [],
    },
    {
      title: "TAR Analysis",
      steps: groupMap["tar_analysis"] || [],
    },  
    {
      title: "Carry Forward Indent",
      steps: groupMap["carry_fwd_indent"] || [],
    },

    // {
    //   title: "RO Not in IMS",
    //   steps: groupMap["ro_not_in_ims"] || []
    // },
    {
      title: "Dryout Aging",
      steps: groupMap["dryout_aging"] || [],
    },
    {
      title: "Pending Carry Forward Indent",
      steps: groupMap["pending_carry_fwd_indent"] || [],
    },
    {
      title: "Dealer Truck Count",
      steps: groupMap["dealer_truck_count"] || [],
    },
  ];
}