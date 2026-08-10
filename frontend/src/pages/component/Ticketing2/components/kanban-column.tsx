import { Card } from "@/@/components/ui/card";
import { Badge } from "@/@/components/ui/badge";
import { Button } from "@/@/components/ui/button";
import { TicketCard } from "./ticket-card";
import { Ticket } from "../types/ticket";
import { motion } from "framer-motion";
import { ReactNode } from "react";
import React from "react";
import { Flag } from "lucide-react";

interface KanbanColumnProps {
  title: string;
  tickets: Ticket[];
  count: number;
  color: string;
  children?: ReactNode;
  showOverdueFilter?: boolean;
  isOverdueFilterActive?: boolean;
  onToggleOverdueFilter?: () => void;
}

const columnStyles = {
  "TO DO": {
    header: "bg-gray-100 text-gray-700 border-gray-200",
    container: "bg-gray-50/30",
  },
  "IN PROGRESS": {
    header: "bg-blue-100 text-blue-700 border-blue-200",
    container: "bg-blue-50/30",
  },
  CANCELLED: {
    header: "bg-red-100 text-red-700 border-red-200",
    container: "bg-red-50/30",
  },
  RESOLVED: {
    header: "bg-green-100 text-green-700 border-green-200",
    container: "bg-green-50/30",
  },
  "ON HOLD": {
    header: "bg-orange-100 text-orange-700 border-orange-200",
    container: "bg-orange-50/30",
  },
  "RE OPEN": {
    header: "bg-purple-100 text-purple-700 border-purple-200",
    container: "bg-purple-50/30",
  },
  "ON COMPLETED": {
    header: "bg-teal-100 text-teal-700 border-teal-200",
    container: "bg-teal-50/30",
  },
};

const KanbanColumnComponent: React.FC<KanbanColumnProps> = ({
  title,
  count,
  children,
  showOverdueFilter = false,
  isOverdueFilterActive = false,
  onToggleOverdueFilter,
}) => {
  const styles =
    columnStyles[title as keyof typeof columnStyles] || columnStyles["TO DO"];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-lg px-3 py-2 mb-2 border ${styles.header} flex items-center justify-between`}
      >
        <h3 className="font-semibold text-xs uppercase tracking-wide">
          {title}
        </h3>
        <div className="flex items-center gap-2">
          {showOverdueFilter && (
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 w-6 p-0 ${
                isOverdueFilterActive
                  ? "bg-red-100 hover:bg-red-200"
                  : "hover:bg-gray-200"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleOverdueFilter?.();
              }}
              title={isOverdueFilterActive ? "Show all tickets" : "Show overdue tickets only"}
            >
              <Flag className="h-3.5 w-3.5 text-red-600" fill="currentColor" />
            </Button>
          )}
          <Badge
            variant="secondary"
            className="bg-white/80 text-gray-700 font-bold text-xs px-1.5 py-0"
          >
            {count}
          </Badge>
        </div>
      </motion.div>
      <div className={`flex-1 rounded-lg ${styles.container} overflow-y-auto kanban-scroll-hide`}>
        {children}{" "}
        {/* This is the Droppable area, react-beautiful-dnd manages its children */}
      </div>
    </div>
  );
};
export const KanbanColumn = React.memo(KanbanColumnComponent);
