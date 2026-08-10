
import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "../../../@/lib/utils";

const Tabs_chart = TabsPrimitive.Root;

const TabsList_chart = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-9 items-center justify-center rounded-lg bg-white p-1 text-muted-foreground", // Removed border from TabsList
      className
    )}
    {...props}
  />
));
TabsList_chart.displayName = TabsPrimitive.List.displayName;

const TabsTrigger_chart = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-[#DDD3FF] text-[#767578] hover:text-[#6941C6] hover:border-[#DDD3FF] data-[state=active]:bg-[#F8F6FF] data-[state=active]:text-[#6941C6] data-[state=active]:border-[#DDD3FF] mx-1", // Added margin for spacing and removed box shadow
      className
    )}
    {...props}
  />
));
TabsTrigger_chart.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent_chart = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", 
      className
    )}
    {...props}
  />
));
TabsContent_chart.displayName = TabsPrimitive.Content.displayName;

export { Tabs_chart, TabsList_chart, TabsTrigger_chart, TabsContent_chart };
