export interface TimelineEvent {
  action: string;
  timestamp: string;
  action_msg?: string;
  allocated_time?: string;
  processed_time?: string;
}
  
  export const formatTimelineEvents = (data: string[]): TimelineEvent[] => {
    return data.map(event => {
      const parts = event.split(" at ");
      return {
        action: parts[0],
        timestamp: parts[1]?.split(",")[0] || ""
      };
    });
  };