// import React, { useState } from 'react';
// import { ChevronDown, ChevronUp } from 'lucide-react';
// import { Card, CardContent } from '../../../../../@/components/ui/card';

// const ErrorMessageWithSuggestions = () => {
//   const [isOpen, setIsOpen] = useState(false);

//   const suggestions = [
//     {
//       title: "Display the total number of distinct components in the billing data",
//       prompt: "Show the total number of distinct components in my billing data."
//     },
//     {
//       title: "Display the total billing amount for the top 10 regions and components, grouped by region and component",
//       prompt: "What's the total billing amount for the top 10 regions and components?"
//     },
//     {
//       title: "Provide the top 100 distinct component costs in Asia Pacific (Tokyo) for Q3 2024",
//       prompt: "Show the top 100 distinct component costs in Asia Pacific (Tokyo) for Q3 2024."
//     }
//   ];

//   return (
//     <div className="w-full max-w-6xl mx-auto">
//       <Card className="border-gray-200 w-full">
//         <CardContent className="p-2">
//           <div className="flex justify-between items-start">
//             <span className="text-gray-700 text-sm">
//               It looks like we couldn't find a helpful answer right now. Please try rephrasing your question or ask something else!
//             </span>
//             <button
//               onClick={() => setIsOpen(!isOpen)}
//               className="text-blue-600 hover:text-blue-700 flex items-center font-medium text-sm"
//             >
//               more
//               {isOpen ? (
//                 <ChevronUp className="ml-1 h-4 w-4" />
//               ) : (
//                 <ChevronDown className="ml-1 h-4 w-4" />
//               )}
//             </button>
//           </div>

//           {isOpen && (
//             <div className="mt-2">
//               <div className="text-gray-800 font-medium text-sm mb-4">You can try one of the following:</div>
//               <div className="space-y-2"> {/* Reduced the space between items */}
//                 {suggestions.map((suggestion, index) => (
//                   <div
//                     key={index}
//                     className="bg-gray-50 hover:bg-gray-100 p-3 rounded-lg border border-gray-200 transition-all duration-300" // Reduced padding for smaller height
//                   >
//                     <h3 className="font-bold text-gray-800 text-sm mb-1">
//                       {suggestion.title}
//                     </h3>
//                     <p className="text-gray-600 text-sm italic">
//                       Example Prompt:{' '}
//                       <span className="font-bold text-sm text-blue-600">
//                         "{suggestion.prompt}"
//                       </span>
//                     </p>
//                   </div>
//                 ))}
//               </div>
//             </div>
//           )}
//         </CardContent>
//       </Card>
//     </div>
//   );
// };

// export default ErrorMessageWithSuggestions;
import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '../../../../../@/components/ui/card';

const ErrorMessageWithSuggestions = () => {
  const [isOpen, setIsOpen] = useState(false);

  const suggestions = [
    {
      title: "Display the total number of distinct components in the billing data",
      prompt: "Show the total number of distinct components in my billing data."
    },
    {
      title: "Display the total billing amount for the top 10 regions and components, grouped by region and component",
      prompt: "What's the total billing amount for the top 10 regions and components?"
    },
    {
      title: "Provide the top 100 distinct component costs in Asia Pacific (Tokyo) for Q3 2024",
      prompt: "Show the top 100 distinct component costs in Asia Pacific (Tokyo) for Q3 2024."
    }
  ];

  return (
    <div className="w-full max-w-7xl mx-auto">
      <Card className="border-gray-200 w-full">
        <CardContent className="p-2">
          <div className="flex items-center gap-2">
            <span className="text-gray-700 text-sm">
              It looks like we couldn't find a helpful answer right now. Please try rephrasing your question or ask something else!
            </span>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-blue-600 hover:text-blue-700 flex items-center font-medium text-sm whitespace-nowrap"
            >
              more
              {isOpen ? (
                <ChevronUp className="ml-1 h-4 w-4" />
              ) : (
                <ChevronDown className="ml-1 h-4 w-4" />
              )}
            </button>
          </div>

          {isOpen && (
            <div className="mt-2">
              <div className="text-gray-800 font-medium text-sm mb-4">You can try one of the following:</div>
              <div className="space-y-2">
                {suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="bg-gray-50 hover:bg-gray-100 p-3 rounded-lg border border-gray-200 transition-all duration-300"
                  >
                    <h3 className="font-bold text-gray-800 text-sm mb-1">
                      {suggestion.title}
                    </h3>
                    <p className="text-gray-600 text-sm italic">
                      Example Prompt:{' '}
                      <span className="font-bold text-sm text-blue-600">
                        "{suggestion.prompt}"
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ErrorMessageWithSuggestions;