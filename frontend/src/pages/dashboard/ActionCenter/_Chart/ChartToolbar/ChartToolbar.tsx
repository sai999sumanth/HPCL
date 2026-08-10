// import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../../../@/components/ui/tooltip"
// import { Button } from "../../../../../@/components/ui/button";
// import { Separator } from "../../../../../@/components/ui/separator";
// import { Popover, PopoverContent, PopoverTrigger } from "../../../../../@/components/ui/popover";
// import { IconPlus } from "@tabler/icons-react";

// export const ChartToolbar = ({createChart}) => {
//   return (
//     <div className="flex items-center p-3">
//       <TooltipProvider>
//         <div className="flex items-center gap-2">
//           <span className="">Charts</span>
//         </div>
//         <div className="ml-auto flex items-center gap-2">
//           <Tooltip>
//             <TooltipTrigger asChild>
//               <Button variant="ghost" size="default" className="bg-violet-500 hover:bg-violet-700 hover:text-white text-white">
//                 <div className="flex gap-2">
//                   <span className="text-md">BULK SELECT</span>
//                 </div>
//               </Button>
//             </TooltipTrigger>
//             <TooltipContent>Forward</TooltipContent>
//           </Tooltip>
//         </div>
//         <Separator orientation="vertical" className="mx-2 h-6" />
//           <Tooltip>
//             <TooltipTrigger asChild>
//               <Button onClick={createChart} variant="ghost" size="default" className="bg-violet-500 hover:bg-violet-700 hover:text-white text-white">
//                 <div className="flex gap-2">
//                   <IconPlus className="h-5 w-4" stroke={1.5} /> 
//                   <span className="text-md">CHART</span>
//                 </div>
//               </Button>
//             </TooltipTrigger>
//             <TooltipContent>Create</TooltipContent>
//           </Tooltip>
//         </TooltipProvider>
//     </div>
//   );
// // }
// import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../../../@/components/ui/tooltip";
// import { Button } from "../../../../../@/components/ui/button";
// import { Separator } from "../../../../../@/components/ui/separator";
// import { Popover, PopoverContent, PopoverTrigger } from "../../../../../@/components/ui/popover";
// import { IconPlus } from "@tabler/icons-react";

// export const ChartToolbar = ({ createChart }) => {
//   return (
//     <div className="flex items-center p-3 bg-white">
//       <TooltipProvider>
//         <div className="flex items-center gap-2">
//           <span>Charts</span>
//         </div>
//         <div className="ml-auto flex items-center gap-2">
//           <Tooltip>
//             <TooltipTrigger asChild>
//               <Button variant="ghost" size="default" className="bg-violet-500 hover:bg-violet-700 hover:text-white text-white">
//                 <div className="flex gap-2">
//                   <span className="text-md">BULK SELECT</span>
//                 </div>
//               </Button>
//             </TooltipTrigger>
//             <TooltipContent>Forward</TooltipContent>
//           </Tooltip>
//         </div>
//         <Separator orientation="vertical" className="mx-2 h-6" />
//         <Tooltip>
//           <TooltipTrigger asChild>
//             <Button onClick={createChart} variant="ghost" size="default" className="bg-violet-500 hover:bg-violet-700 hover:text-white text-white">
//               <div className="flex gap-2">
//                 <IconPlus className="h-5 w-4" stroke={1.5} />
//                 <span className="text-md">CHART</span>
//               </div>
//             </Button>
//           </TooltipTrigger>
//           <TooltipContent>Create</TooltipContent>
//         </Tooltip>
//       </TooltipProvider>
//     </div>
//   );
// }
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../../../@/components/ui/tooltip";
import { Button } from "../../../../../@/components/ui/button";
import { Separator } from "../../../../../@/components/ui/separator";
import { IconPlus } from "@tabler/icons-react";

export const ChartToolbar = ({ createChart }) => {
  return (
    <div className="flex items-center p-3 bg-white">
      <TooltipProvider>
        <div className="flex items-center gap-2">
          <span>Charts</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="default" className="bg-[#FDF8F7] hover:bg-[#4b1f57] hover:text-white text-[#0047AB]">
                <div className="flex gap-2">
                  <span className="text-md">BULK SELECT</span>
                </div>
              </Button>
            </TooltipTrigger>
            {/* <TooltipContent className="bg-white text-[#682a7a]">Forward</TooltipContent> */}
            <TooltipContent className="bg-white text-[#0047AB] shadow-lg">Forward</TooltipContent>

          </Tooltip>
        </div>
        <Separator orientation="vertical" className="mx-2 h-6" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={createChart} variant="ghost" size="default" className="bg-[#0047AB] hover:bg-[#4b1f57] hover:text-white text-white">
              <div className="flex gap-2">
                <IconPlus className="h-5 w-4" stroke={1.5} />
                <span className="text-md">CHART</span>
              </div>
            </Button>
          </TooltipTrigger>
          <TooltipContent className="bg-white text-[#0047AB] shadow-lg">Create</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
