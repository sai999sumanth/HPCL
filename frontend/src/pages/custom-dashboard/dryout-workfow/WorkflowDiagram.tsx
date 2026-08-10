import { workflowData, groupWorkflowSteps } from '@/types/workflowData';
import { WorkflowSection } from './WorkflowSection';
import { cn } from '@/@/lib/utils';
import { useGlobalVisibility } from '@/store/VisibilityProvider';

export default function WorkflowDiagram(props) {
  const { dryoutCounts, type } = props;

  const groupedSteps = groupWorkflowSteps(dryoutCounts || []);

  const hasData = (g) => g && g.steps && g.steps.length > 0;

  const initialAndPendingSteps = groupedSteps.slice(0, 2).filter(hasData);
  const indentSteps = groupedSteps.slice(2, 3).filter(hasData);
  const ttPendingSteps = groupedSteps.slice(3, 4).filter(hasData);
  const dryoutAnalysis = groupedSteps.slice(4, 5).filter(hasData);
  const wipSteps = groupedSteps.slice(5, 6).filter(hasData);
  const deliveredAndTruckSteps = groupedSteps.slice(6, 7).filter(hasData);
  const tarAnalysis = [groupedSteps[7]].filter(hasData);
  const carryFwdSteps = groupedSteps.slice(8, 9).filter(hasData);
  const pendingcarryFwdSteps = groupedSteps.slice(10, 11).filter(hasData);
  const dealerTruckCountSteps = groupedSteps.slice(11, 12).filter(hasData);

  const { visibleItems } = useGlobalVisibility();

  return (
    <div className="p-2 space-y-2">

      {/* Initial + Pending */}
      {initialAndPendingSteps.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {initialAndPendingSteps.map((group, index) => (
            <div
              key={index}
              className={cn(
                "flex-shrink-0",
                group.title !== "Pending" ? "w-96" : "flex-1"
              )}
            >
              <WorkflowSection title={group.title} steps={group.steps} />
            </div>
          ))}
        </div>
      )}

      {/* WIP */}
      {type === 'sod' && wipSteps.length > 0 && (
        <div className="flex w-full">
          {wipSteps.map((group, index) => (
            <div key={index} className="flex-1">
              <WorkflowSection
                title={group.title}
                steps={group.steps}
                isWorkInProgress={true}
                singleRow={true}
              />
            </div>
          ))}
        </div>
      )}

      {/* Delivered + Truck */}
      {type === 'sod' && deliveredAndTruckSteps.length > 0 && (
        <div className="flex flex-wrap">
          {deliveredAndTruckSteps.map((group, index) => (
            <div
              key={index}
              className={cn(
                "flex-shrink-0",
                group.title === "Delivered" ? "w-full" : "flex-1"
              )}
            >
              <WorkflowSection title={group.title} steps={group.steps} />
            </div>
          ))}
        </div>
      )}

      {/* Retail: Indent (separate section, distinct cards) */}
      {type === 'retail' && indentSteps.length > 0 && (
        <div className="flex w-full">
          {indentSteps.map((group, index) => (
            <div key={index} className="flex-1 w-full min-w-0">
              <WorkflowSection
                title={group.title}
                steps={group.steps}
                isWorkInProgress={true}
                singleRow={false}
              />
            </div>
          ))}
        </div>
      )}

      {/* Dryout Analysis – distinct cards, horizontal wrap (SOD + RO) */}
      {(type === 'sod' || type === 'retail') && dryoutAnalysis.length > 0 && (
        <div className="flex w-full">
          {dryoutAnalysis.map((group, index) => (
            <div key={index} className="flex-1 w-full min-w-0">
              <WorkflowSection
                title={group.title}
                steps={group.steps}
                isWorkInProgress={true}
                singleRow={false}
              />
            </div>
          ))}
        </div>
      )}

      {/* TAR Analysis – distinct cards, horizontal wrap (SOD + RO) */}
      {(type === 'sod' || type === 'retail') && tarAnalysis.length > 0 && (
        <div className="flex w-full">
          {tarAnalysis.map((group, index) => (
            <div key={index} className="flex-1 w-full min-w-0">
              <WorkflowSection
                title={group.title}
                steps={group.steps}
                isWorkInProgress={true}
                singleRow={false}
              />
            </div>
          ))}
        </div>
      )}

      {/* SOD: carry_fwd_indent, pending_carry_fwd_indent, dealer_truck_count */}
      {type === 'sod' && (carryFwdSteps.length > 0 || pendingcarryFwdSteps.length > 0 || dealerTruckCountSteps.length > 0) && (
        <div className="flex flex-wrap gap-2 w-full">
          {[...carryFwdSteps, ...pendingcarryFwdSteps, ...dealerTruckCountSteps].map((group, index) => (
            <div key={index} className="flex-1 min-w-0">
              <WorkflowSection
                title={group.title}
                steps={group.steps}
                isWorkInProgress={true}
                singleRow={true}
              />
            </div>
          ))}
        </div>
      )}

      {/* TT Pending */}
      {type === 'sod' && ttPendingSteps.length > 0 && (
        <div className="flex w-full">
          {ttPendingSteps.map((group, index) => (
            <div key={index} className="flex-1">
              <WorkflowSection
                title={group.title}
                steps={group.steps}
                isWorkInProgress={true}
                singleRow={true}
              />
            </div>
          ))}
        </div>
      )}

      {/* RO: dealer_truck_count only (Carry Forward Indent, Pending Carry Forward Indent not shown in RO) */}
      {type === 'retail' && dealerTruckCountSteps.length > 0 && (
        <div className="flex w-full">
          {dealerTruckCountSteps.map((group, index) => (
            <div key={index} className="flex-1">
              <WorkflowSection
                title={group.title}
                steps={group.steps}
                isWorkInProgress={true}
                singleRow={true}
              />
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
