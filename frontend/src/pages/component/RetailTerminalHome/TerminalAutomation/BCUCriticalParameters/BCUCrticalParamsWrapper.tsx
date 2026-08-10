import React, { useState, useRef, useEffect } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/@/components/ui/accordion";
import LocalLoadedSection from "./LocalLoadedSection";
import BayReassignSection from "./BayReassignSection";
import UnauthorisedFlowSection from "./UnauthorisedFlowSection";
import SickTTsSection from "./SickTTsSection";
import CancelledTTsSection from "./CancelledTTsSection";
import KFactorSection from "./KFactorSection";
import MFMKFactorSection from "./MFMKFactorSection";
import ManualFanPrintSection from "./ManualFanPrintSection";
import OverloadedTTsSection from "./OverloadedTTsSection";
import AnalogPage from "./analogpage";

interface FilterValue {
  key: string;
  cond: string;
  value: string;
}

interface ChartProps {
  filters: FilterValue[];
  zone?: string | null;
  plant?: string | null;
}

const accordionItems = [
  { value: "item-1", label: "Local Loaded TT", portalId: "bcu-filters-item-1" },
  { value: "item-2", label: "Bay Reassignment/Manual Bay Assignment", portalId: "bcu-filters-item-2" },
  { value: "item-3", label: "Unauthorised Flow", portalId: "bcu-filters-item-3" },
  { value: "item-4", label: "Sick TT", portalId: "bcu-filters-item-4" },
  { value: "item-5", label: "Cancelled TT", portalId: "bcu-filters-item-5" },
  { value: "item-6", label: "K-Factor Changes", portalId: "bcu-filters-item-6" },
  { value: "item-7", label: "MFMKFactor", portalId: "bcu-filters-item-7" },
  { value: "item-8", label: "Manual Fan Printed", portalId: "bcu-filters-item-8" },
  { value: "item-9", label: "Overloaded TT", portalId: "bcu-filters-item-9" },
];

const sectionComponents: Record<string, React.FC<any>> = {
  "item-1": LocalLoadedSection,
  "item-2": BayReassignSection,
  "item-3": UnauthorisedFlowSection,
  "item-4": SickTTsSection,
  "item-5": CancelledTTsSection,
  "item-6": KFactorSection,
  "item-7": MFMKFactorSection,
  "item-8": ManualFanPrintSection,
  "item-9": OverloadedTTsSection,
};

export const BCUCrticalParamsWrapper: React.FC<ChartProps> = ({ filters, zone, plant }) => {
  const [openValue, setOpenValue] = useState<string | undefined>(undefined);
  const itemRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    if (openValue && itemRefs.current[openValue]) {
      setTimeout(() => {
        const element = itemRefs.current[openValue];
        if (element) {
          const offset = 80;
          const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
          const offsetPosition = elementPosition - offset;

          window.scrollTo({
            top: offsetPosition,
            behavior: "smooth",
          });
        }
      }, 300);
    }
  }, [openValue]);

  return (
    <div className="w-full space-y-4 bg-white">
      <AnalogPage zone={zone} plant={plant} />
      <Accordion 
        type="single" 
        collapsible 
        className="w-full space-y-2"
        value={openValue}
        onValueChange={(value) => setOpenValue(value)}
      >
        {accordionItems.map((item) => {
          const SectionComponent = sectionComponents[item.value];
          return (
            <AccordionItem
              key={item.value}
              ref={(el) => (itemRefs.current[item.value] = el)}
              value={item.value}
              className="border border-gray-200 rounded-lg bg-white shadow-sm"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-50 rounded-t-lg">
                <div className="flex items-center w-full pr-2">
                  <h2 className="text-sm font-medium text-gray-700 shrink-0">{item.label}</h2>
                  <div
                    id={item.portalId}
                    className="flex items-center gap-2 ml-auto"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-2">
                <SectionComponent
                  filters={filters}
                  zone={zone}
                  plant={plant}
                  filterPortalId={item.portalId}
                />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
};

export default BCUCrticalParamsWrapper;