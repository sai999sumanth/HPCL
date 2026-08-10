
import { Badge } from "@/@/components/ui/badge";
import { Ticket } from "../types/ticket";
import { motion } from "framer-motion";
import { TicketIcon } from "lucide-react";

interface TicketStatsProps {
  tickets: Ticket[];
  totalTicketCount: number;
}

export function TicketStats({ tickets, totalTicketCount }: TicketStatsProps) { 
  // Calculate total from displayed tickets (RO + TAS + LPG) to match kanban board cards
  const roCount = tickets.filter((t) => t.bu === "RO" || t.bu === "BU").length;
  const tasCount = tickets.filter((t) => t.bu === "TAS").length;
  const lpgCount = tickets.filter((t) => t.bu === "LPG").length;
  const displayCount = roCount + tasCount + lpgCount;
  const safeTotalCount =
    Number.isFinite(totalTicketCount) && totalTicketCount >= 0
      ? totalTicketCount
      : displayCount;
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.05 }}
      className="flex items-center gap-1.5 flex-shrink-0 shrink-0"
    >
      {/* <TicketIcon className="h-4 w-4" /> */}
      <span className="text-xs font-medium text-gray-700">Total Tickets:</span>
      <Badge className="bg-gray-100 text-gray-700 border-gray-300 font-semibold border text-sm px-1.5 py-0">
        {safeTotalCount}
      </Badge>
    </motion.div>
  );
}