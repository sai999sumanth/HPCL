// import * as React from "react"
// import { Switch } from "@/@/components/ui/switch"

// export function CustomSwitch() {
//   const [isCumulative, setIsCumulative] = React.useState(true)

//   return (
//     <div className="flex items-center space-x-2">
//       <span className={`text-xs font-bold ${isCumulative ? "text-gray-600" : "text-green-600"}`}>Month</span>
//       <Switch checked={isCumulative} onCheckedChange={setIsCumulative} className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-green-600" />
//       <span className={`text-xs font-bold ${isCumulative ? "text-green-600" : "text-gray-600"}`}>Cumulative</span>
//     </div>
//   )
// }

// import * as React from "react"
// import { Switch } from "@/@/components/ui/switch"

// export function CustomSwitch() {
//   const [isCumulative, setIsCumulative] = React.useState(true)
//   const [isMT, setIsMT] = React.useState(true)

//   return (
//     <div className="flex flex-col space-y-2">
//       {/* First Switch: Month / Cumulative */}
//       <div className="flex items-center space-x-2">
//         <span className={`text-xs font-bold ${isCumulative ? "text-gray-600" : "text-[#0d9488]"}`}>Month</span>
//         <Switch
//           checked={isCumulative}
//           onCheckedChange={setIsCumulative}
//           className="data-[state=checked]:bg-[#0d9488] data-[state=unchecked]:bg-[#0d9488]"
//         />
//         <span className={`text-xs font-bold ${isCumulative ? "text-[#0d9488]" : "text-gray-600"}`}>Cumulative</span>
//       </div>

//       {/* Second Switch: MT / TMT */}
//       <div className="flex items-center space-x-2">
//         <span className={`text-xs font-bold ${isMT ? "text-gray-600" : "text-[#0d9488]"}`}>MT</span>
//         <Switch
//           checked={isMT}
//           onCheckedChange={setIsMT}
//           className="data-[state=checked]:bg-[#0d9488] data-[state=unchecked]:bg-[#0d9488]"
//         />
//         <span className={`text-xs font-bold ${isMT ? "text-[#0d9488]" : "text-gray-600"}`}>TMT</span>
//       </div>
//     </div>
//   )
// }
import * as React from "react";
import { Switch } from "@/@/components/ui/switch";

export function MonthCumulativeSwitch() {
  const [isCumulative, setIsCumulative] = React.useState(true);

  return (
    <div className="flex items-center space-x-2">
      <span className={`text-xs font-bold ${isCumulative ? "text-gray-600" : "text-[#0d9488]"}`}>Month</span>
      <Switch
        checked={isCumulative}
        onCheckedChange={setIsCumulative}
        className="data-[state=checked]:bg-[#0d9488] data-[state=unchecked]:bg-[#0d9488]"
      />
      <span className={`text-xs font-bold ${isCumulative ? "text-[#0d9488]" : "text-gray-600"}`}>Cumulative</span>
    </div>
  );
}

export function MTTMTSwitch() {
  const [isMT, setIsMT] = React.useState(true);

  return (
    <div className="flex items-center space-x-2">
      <span className={`text-xs font-bold ${isMT ? "text-gray-600" : "text-[#0d9488]"}`}>MT</span>
      <Switch
        checked={isMT}
        onCheckedChange={setIsMT}
        className="data-[state=checked]:bg-[#0d9488] data-[state=unchecked]:bg-[#0d9488]"
      />
      <span className={`text-xs font-bold ${isMT ? "text-[#0d9488]" : "text-gray-600"}`}>TMT</span>
    </div>
  );
}
