// import React, { useState } from 'react';
// import { Popover } from '../../@/components/ui/popover';
// import { PopoverContent, PopoverTrigger } from '../../@/components/ui/popover';

// const UserAvatar = ({ email, fullName }) => {
//   const [isOpen, setIsOpen] = useState(false);
  
//   const getInitials = () => {
//     if (!fullName) return 'NA';
//     const nameParts = fullName.split(' ');
//     if (nameParts.length >= 2) {
//       return (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase();
//     }
//     return nameParts[0].substring(0, 2).toUpperCase();
//   };

//   return (
//     <Popover open={isOpen} onOpenChange={setIsOpen}>
//       <PopoverTrigger asChild>
//         <button
//           className="w-8 h-8 rounded-full text-[#0047AB] text-sm font-medium flex items-center justify-center hover:text-[#0047AB] border  transition-colors"
//         >
//           {getInitials()}
//         </button>
//       </PopoverTrigger>
//       <PopoverContent className="p-0 w-auto">
//         <div className="bg-[#0047AB] text-white p-1 rounded-lg min-w-[250px]">
//           <div className="space-y-0">
//             <div className="flex items-center gap-0">
//               <span className="font-small min-w-10">Name:</span>
//               <span>{fullName}</span>
//             </div>
//             <div className="flex items-center gap-0">
//               <span className="font-small min-w-10">Email:</span>
//               <span>{email}</span>
//             </div>
//           </div>
//         </div>
//       </PopoverContent>
//     </Popover>
//   );
// };

// export default UserAvatar;

import React, { useState } from 'react';
import { Popover } from '../../@/components/ui/popover';
import { PopoverContent, PopoverTrigger } from '../../@/components/ui/popover';

const UserAvatar = ({ email, fullName }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const getInitials = () => {
    if (!fullName) return 'NA';
    const nameParts = fullName.split(' ');
    if (nameParts.length >= 2) {
      return (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase();
    }
    return nameParts[0].substring(0, 2).toUpperCase();
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className="w-8 h-8 rounded-full text-[#0047AB] text-xs font-medium flex items-center justify-center hover:text-[#0047AB] border transition-colors"
        >
          {getInitials()}
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-auto min-w-[200px]">
        <div className="bg-[#0047AB] text-white p-2 rounded-lg text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className=" min-w-1px] whitespace-nowrap font-semibold">Name:</span>
              <span className="flex-1 overflow-hidden text-ellipsis">{fullName}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className=" min-w-[1px] whitespace-nowrap font-semibold">Email:</span>
              <span className="flex-1 overflow-hidden text-ellipsis">{email}</span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default UserAvatar;