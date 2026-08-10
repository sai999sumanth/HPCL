import { useState } from "react";
import { Calendar, CheckCircle2, ChevronDown, Clock } from "lucide-react";
import { cn } from "@/@/lib/utils";
import { Button } from "@/@/components/ui/button";
import { ScrollArea } from "@/@/components/ui/scroll-area";
import type { TimelineEvent } from "@/@/lib/formatters";
import { calculateInboxTime } from "@/utils/duration";

interface TimelineProps {
  events: TimelineEvent[];
}

export function Timeline({ events }: TimelineProps) {
  const [showAll, setShowAll] = useState(false);
  const [visibleDetails, setVisibleDetails] = useState<number[]>([]);
  const displayEvents = events; // showAll ? events : events.slice(0, 5);

  const toggleDetails = (index: number) => {
    setVisibleDetails(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  return (
    <div className="space-y-0">
      <ScrollArea className="h-[275px] pr-4">
        <div className="space-y-8">
          {displayEvents.map((event, index) => (
            <div className="flex justify-between">
              <div key={index} className="relative flex items-center">
                <div 
                  className={cn(
                    "ml-0 flex flex-col space-y-1 animate-in slide-in-from-left-5"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="font-medium">{event.action_msg}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-4 text-blue-600" />
                    <time className="text-sm text-muted-foreground">
                      Duration: {calculateInboxTime(event.processed_time, event.allocated_time)}
                    </time>
                  </div>
                  {visibleDetails.includes(index) && (
                    <div className="flex gap-5">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-4 text-blue-600" />
                        <time className="text-sm text-muted-foreground">
                          Start Time: {event.allocated_time}
                        </time>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-4 text-blue-600" />
                        <time className="text-sm text-muted-foreground">
                          End Time: {event.processed_time}
                        </time>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="">
                <div className="flex items-center gap-2">
                  <Button className="" variant="ghost" onClick={() => toggleDetails(index)}>
                  {visibleDetails.includes(index) ? 'Hide details' : 'Show details'}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      
      {/* {!showAll && events.length > 5 && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-2"
            onClick={() => setShowAll(true)}
          >
            Show More
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      )} */}
    </div>
  );
}