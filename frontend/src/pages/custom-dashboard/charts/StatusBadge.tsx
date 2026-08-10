import { cn } from "@/@/lib/utils";
import { CheckCircle2 } from "lucide-react";

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const isCompleted = status === "Completed";

  return (
    <div className={cn(
      "relative inline-flex items-center gap-2 px-3 py-1 rounded-full",
      "bg-green-200 text-green",
      "transition-all duration-500"
    )}>
      <span className={cn(
        "absolute inset-0 rounded-full",
        "animate-pulse bg-primary/5"
      )} />
      <CheckCircle2 className={cn(
        "h-4 w-4 transition-transform duration-500",
        isCompleted && "animate-[spin_1s_ease-in-out]"
      )} />
      <span className="relative font-medium text-sm text-green">
        {status}
      </span>
      {isCompleted && (
        <span className={cn(
          "absolute inset-0 rounded-full",
          "animate-[ping_1s_cubic-bezier(0,0,0.2,1)_1]",
          "bg-green/30"
        )} />
      )}
    </div>
  );
}