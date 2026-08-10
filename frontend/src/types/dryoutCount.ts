export interface WorkflowStep {
    section: string;
    value: number;
    serial: number;
    condition: string;
    group: string;
  }
  
  export interface GroupedSteps {
    title: string;
    steps: WorkflowStep[];
    isWorkInProgress?: boolean;
  }