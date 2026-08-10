// import React from 'react';
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../../@/components/ui/data-table";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../../@/components/ui/tabs";
// import { Trash2, Plus } from 'lucide-react'; // Added Plus icon for potential use

// interface Expression {
//   targetColumn: string;
//   expression: string;
// }

// interface ExpressionTabsProps {
//   expressions: Expression[];
//   onRemoveExpression: (index: number) => void;
//   activeTab: string;
//   onTabChange: (value: string) => void;
//   onAddExpression?: () => void; // Optional for adding expressions
// }

// const ExpressionTabs: React.FC<ExpressionTabsProps> = ({ expressions, onRemoveExpression, activeTab, onTabChange, onAddExpression }) => {
//   return (
//     <Tabs defaultValue="expressions" className="w-full" value={activeTab} onValueChange={onTabChange}>
//       {/* Tabs header - Only Expressions tab, removed Advanced tab */}
//       <TabsList className="flex justify-start w-full mb-4">
//         <TabsTrigger value="expressions" className="px-4 py-2 font-semibold text-gray-700 border-b-2 border-blue-500">Expressions</TabsTrigger>
//         {/* Add a '+' button for adding new expressions */}
//         {onAddExpression && (
//           <button
//             className="ml-auto flex items-center justify-center p-1 rounded-full bg-blue-500 text-white hover:bg-blue-600"
//             onClick={onAddExpression}
//           >
//             <Plus className="w-4 h-4" />
//           </button>
//         )}
//       </TabsList>

//       <TabsContent value="expressions">
//         {/* Table with proper borders and alignment */}
//         <Table className="table-auto w-full border-collapse">
//           <TableHeader className="bg-gray-100 border-b">
//             <TableRow>
//               <TableHead className="text-xs font-semibold px-4 py-2 text-left">Target Column</TableHead>
//               <TableHead className="text-xs font-semibold px-4 py-2 text-left">Expression</TableHead>
//               <TableHead className="text-xs font-semibold px-4 py-2"></TableHead>
//             </TableRow>
//           </TableHeader>
//           <TableBody>
//             {expressions.map((expr, index) => (
//               <TableRow key={index} className="border-b hover:bg-gray-50">
//                 <TableCell className="text-xs px-4 py-2">{expr.targetColumn}</TableCell>
//                 <TableCell className="text-xs px-4 py-2">
//                   <code className={`bg-gray-100 rounded-md px-2 py-1 ${expr.targetColumn === 'account_length_days' ? 'text-purple-600' : ''}`}>
//                     {expr.expression}
//                   </code>
//                 </TableCell>
//                 <TableCell className="px-4 py-2 text-right">
//                   <Trash2
//                     className="h-4 w-4 text-gray-400 cursor-pointer hover:text-red-500"
//                     onClick={() => onRemoveExpression(index)}
//                   />
//                 </TableCell>
//               </TableRow>
//             ))}
//           </TableBody>
//         </Table>
//       </TabsContent>
//     </Tabs>
//   );
// };

// // export default ExpressionTabs;
// import React, { useState } from 'react';
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../../@/components/ui/data-table";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../../@/components/ui/tabs";
// import { Trash2, Edit, Check } from 'lucide-react';
// import { Input } from "../../../../../@/components/ui/input";

// interface Expression {
//   targetColumn: string;
//   expression: string;
// }

// interface ExpressionTabsProps {
//   expressions: Expression[];
//   onUpdateExpression: (index: number, updatedExpression: Expression) => void;
//   onRemoveExpression: (index: number) => void;
//   activeTab: string;
//   onTabChange: (value: string) => void;
// }

// const ExpressionTabs: React.FC<ExpressionTabsProps> = ({
//   expressions,
//   onUpdateExpression,
//   onRemoveExpression,
//   activeTab,
//   onTabChange,
// }) => {
//   const [editingIndex, setEditingIndex] = useState<number | null>(null);
//   const [editedExpression, setEditedExpression] = useState<Expression | null>(null);

//   const handleEdit = (index: number) => {
//     setEditingIndex(index);
//     setEditedExpression(expressions[index]);
//   };

//   const handleSave = (index: number) => {
//     if (editedExpression) {
//       onUpdateExpression(index, editedExpression);
//       setEditingIndex(null);
//       setEditedExpression(null);
//     }
//   };

//   const handleInputChange = (field: 'targetColumn' | 'expression', value: string) => {
//     if (editedExpression) {
//       setEditedExpression({ ...editedExpression, [field]: value });
//     }
//   };

//   return (
//     <Tabs defaultValue="expressions" className="w-full" value={activeTab} onValueChange={onTabChange}>
//       <TabsList className="flex justify-start w-full mb-4">
//         <TabsTrigger value="expressions" className="px-4 py-2 font-semibold text-gray-700 border-b-2 border-blue-500">
//           Expressions
//         </TabsTrigger>
//       </TabsList>

//       <TabsContent value="expressions">
//         <Table className="table-auto w-full border-collapse">
//           <TableHeader className="bg-gray-100 border-b">
//             <TableRow>
//               <TableHead className="text-xs font-semibold px-4 py-2 text-left">Target Column</TableHead>
//               <TableHead className="text-xs font-semibold px-4 py-2 text-left">Expression</TableHead>
//               <TableHead className="text-xs font-semibold px-4 py-2"></TableHead>
//             </TableRow>
//           </TableHeader>
//           <TableBody>
//             {expressions.map((expr, index) => (
//               <TableRow key={index} className="border-b hover:bg-gray-50">
//                 <TableCell className="text-xs px-4 py-2">
//                   {editingIndex === index ? (
//                     <Input
//                       value={editedExpression?.targetColumn || ''}
//                       onChange={(e) => handleInputChange('targetColumn', e.target.value)}
//                       className="text-xs"
//                     />
//                   ) : (
//                     expr.targetColumn
//                   )}
//                 </TableCell>
//                 <TableCell className="text-xs px-4 py-2">
//                   {editingIndex === index ? (
//                     <Input
//                       value={editedExpression?.expression || ''}
//                       onChange={(e) => handleInputChange('expression', e.target.value)}
//                       className="text-xs"
//                     />
//                   ) : (
//                     <code className={`bg-gray-100 rounded-md px-2 py-1 ${expr.targetColumn === 'account_length_days' ? 'text-purple-600' : ''}`}>
//                       {expr.expression}
//                     </code>
//                   )}
//                 </TableCell>
//                 <TableCell className="px-4 py-2 text-right">
//                   {editingIndex === index ? (
//                     <Check
//                       className="h-4 w-4 text-green-500 cursor-pointer"
//                       onClick={() => handleSave(index)}
//                     />
//                   ) : (
//                     <>
//                       <Edit
//                         className="h-4 w-4 text-gray-400 cursor-pointer hover:text-blue-500 mr-2"
//                         onClick={() => handleEdit(index)}
//                       />
//                       <Trash2
//                         className="h-4 w-4 text-gray-400 cursor-pointer hover:text-red-500"
//                         onClick={() => onRemoveExpression(index)}
//                       />
//                     </>
//                   )}
//                 </TableCell>
//               </TableRow>
//             ))}
//           </TableBody>
//         </Table>
//       </TabsContent>
//     </Tabs>
//   );
// };

// export default ExpressionTabs;


// import React, { useState } from 'react';
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../../@/components/ui/data-table";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../../@/components/ui/tabs";
// import { Trash2, Edit, Check } from 'lucide-react';
// import { Input } from "../../../../../@/components/ui/input";
// import { Button } from "../../../../../@/components/ui/button";

// interface Expression {
//   targetColumn: string;
//   expression: string;
// }

// interface ExpressionTabsProps {
//   expressions: Expression[];
//   onUpdateExpression: (index: number, updatedExpression: Expression) => void;
//   onRemoveExpression: (index: number) => void;
//   activeTab: string;
//   onTabChange: (value: string) => void;
// }

// const ExpressionTabs: React.FC<ExpressionTabsProps> = ({
//   expressions,
//   onUpdateExpression,
//   onRemoveExpression,
//   activeTab,
//   onTabChange,
// }) => {
//   const [editingIndex, setEditingIndex] = useState<number | null>(null);
//   const [editedExpression, setEditedExpression] = useState<Expression | null>(null);

//   const handleEdit = (index: number) => {
//     setEditingIndex(index);
//     setEditedExpression(expressions[index]);
//   };

//   const handleSave = (index: number) => {
//     if (editedExpression) {
//       onUpdateExpression(index, editedExpression);
//       setEditingIndex(null);
//       setEditedExpression(null);
//     }
//   };

//   const handleInputChange = (field: 'targetColumn' | 'expression', value: string) => {
//     if (editedExpression) {
//       setEditedExpression({ ...editedExpression, [field]: value });
//     }
//   };

//   return (
//     <Tabs defaultValue="expressions" className="w-full" value={activeTab} onValueChange={onTabChange}>
//       <TabsList className="flex justify-start w-full mb-4">
//         <TabsTrigger value="expressions" className="px-4 py-2 font-semibold text-blue-600 border-b-2 border-blue-600">
//           Expressions
//         </TabsTrigger>
//       </TabsList>

//       <TabsContent value="expressions">
//         <Table className="w-full border-collapse">
//           <TableHeader>
//             <TableRow className="bg-gray-50">
//               <TableHead className="w-1/3 text-sm font-semibold text-gray-600 px-4 py-2 text-left">Target Column</TableHead>
//               <TableHead className="w-1/2 text-sm font-semibold text-gray-600 px-4 py-2 text-left">Expression</TableHead>
//               <TableHead className="w-1/6 text-sm font-semibold text-gray-600 px-4 py-2 text-right">Actions</TableHead>
//             </TableRow>
//           </TableHeader>
//           <TableBody>
//             {expressions.map((expr, index) => (
//               <TableRow key={index} className="border-b border-gray-200 hover:bg-gray-50">
//                 <TableCell className="px-4 py-2">
//                   {editingIndex === index ? (
//                     <Input
//                       value={editedExpression?.targetColumn || ''}
//                       onChange={(e) => handleInputChange('targetColumn', e.target.value)}
//                       className="text-sm"
//                     />
//                   ) : (
//                     <span className="text-sm">{expr.targetColumn}</span>
//                   )}
//                 </TableCell>
//                 <TableCell className="px-4 py-2">
//                   {editingIndex === index ? (
//                     <Input
//                       value={editedExpression?.expression || ''}
//                       onChange={(e) => handleInputChange('expression', e.target.value)}
//                       className="text-sm"
//                     />
//                   ) : (
//                     <code className="text-sm bg-gray-100 rounded px-2 py-1">{expr.expression}</code>
//                   )}
//                 </TableCell>
//                 <TableCell className="px-4 py-2 text-right">
//                   {editingIndex === index ? (
//                     <Button variant="ghost" size="sm" onClick={() => handleSave(index)}>
//                       <Check className="h-4 w-4 text-green-500" />
//                     </Button>
//                   ) : (
//                     <div className="flex justify-end space-x-2">
//                       <Button variant="ghost" size="sm" onClick={() => handleEdit(index)}>
//                         <Edit className="h-4 w-4 text-blue-500" />
//                       </Button>
//                       <Button variant="ghost" size="sm" onClick={() => onRemoveExpression(index)}>
//                         <Trash2 className="h-4 w-4 text-red-500" />
//                       </Button>
//                     </div>
//                   )}
//                 </TableCell>
//               </TableRow>
//             ))}
//           </TableBody>
//         </Table>
//       </TabsContent>
//     </Tabs>
//   );
// };

// export default ExpressionTabs;


// import React, { useState } from 'react';
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../../@/components/ui/data-table";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../../@/components/ui/tabs";
// import { Trash2, Edit, Check, MoreHorizontal } from 'lucide-react';
// import { Input } from "../../../../../@/components/ui/input";
// import { Button } from "../../../../../@/components/ui/button";
// import { Popover, PopoverContent, PopoverTrigger } from "../../../../../@/components/ui/popover";

// interface Expression {
//   targetColumn: string;
//   expression: string;
// }

// interface ExpressionTabsProps {
//   expressions: Expression[];
//   onUpdateExpression: (index: number, updatedExpression: Expression) => void;
//   onRemoveExpression: (index: number) => void;
//   activeTab: string;
//   onTabChange: (value: string) => void;
//   onAskAI: (expression: string) => void;
//   onGenerate: (expression: string) => void;
//   onFixIt: (expression: string) => void;
// }

// const ExpressionTabs: React.FC<ExpressionTabsProps> = ({
//   expressions,
//   onUpdateExpression,
//   onRemoveExpression,
//   activeTab,
//   onTabChange,
//   onAskAI,
//   onGenerate,
//   onFixIt
// }) => {
//   const [editingIndex, setEditingIndex] = useState<number | null>(null);
//   const [editedExpression, setEditedExpression] = useState<Expression | null>(null);

//   const handleEdit = (index: number) => {
//     setEditingIndex(index);
//     setEditedExpression(expressions[index]);
//   };

//   const handleSave = (index: number) => {
//     if (editedExpression) {
//       onUpdateExpression(index, editedExpression);
//       setEditingIndex(null);
//       setEditedExpression(null);
//     }
//   };

//   const handleInputChange = (field: 'targetColumn' | 'expression', value: string) => {
//     if (editedExpression) {
//       setEditedExpression({ ...editedExpression, [field]: value });
//     }
//   };

//   return (
//     <Tabs defaultValue="expressions" className="w-full" value={activeTab} onValueChange={onTabChange}>
//       <TabsList className="flex justify-start w-full mb-4">
//         <TabsTrigger value="expressions" className="px-4 py-2 font-semibold text-blue-600 border-b-2 border-blue-600">
//           Expressions
//         </TabsTrigger>
//       </TabsList>

//       <TabsContent value="expressions">
//         <Table className="w-full border-collapse">
//           <TableHeader>
//             <TableRow className="bg-gray-50">
//               <TableHead className="w-1/3 text-sm font-semibold text-gray-600 px-4 py-2 text-left">Target Column</TableHead>
//               <TableHead className="w-1/2 text-sm font-semibold text-gray-600 px-4 py-2 text-left">Expression</TableHead>
//               <TableHead className="w-1/6 text-sm font-semibold text-gray-600 px-4 py-2 text-right">Actions</TableHead>
//             </TableRow>
//           </TableHeader>
//           <TableBody>
//             {expressions.map((expr, index) => (
//               <TableRow key={index} className="border-b border-gray-200 hover:bg-gray-50">
//                 <TableCell className="px-4 py-2">
//                   {editingIndex === index ? (
//                     <Input
//                       value={editedExpression?.targetColumn || ''}
//                       onChange={(e) => handleInputChange('targetColumn', e.target.value)}
//                       className="text-sm"
//                     />
//                   ) : (
//                     <span className="text-sm">{expr.targetColumn}</span>
//                   )}
//                 </TableCell>
//                 <TableCell className="px-4 py-2">
//                   {editingIndex === index ? (
//                     <Input
//                       value={editedExpression?.expression || ''}
//                       onChange={(e) => handleInputChange('expression', e.target.value)}
//                       className="text-sm"
//                     />
//                   ) : (
//                     <div className="flex items-center space-x-2">
//                       <code className="text-sm bg-gray-100 rounded px-2 py-1 flex-grow">{expr.expression}</code>
//                       <Popover>
//                         <PopoverTrigger asChild>
//                           <Button variant="ghost" size="sm">
//                             <MoreHorizontal className="h-4 w-4" />
//                           </Button>
//                         </PopoverTrigger>
//                         <PopoverContent className="w-auto p-0">
//                           <div className="flex space-x-1 p-1">
//                             <Button variant="outline" size="sm" onClick={() => onAskAI(expr.expression)}>
//                               Ask AI
//                             </Button>
//                             <Button variant="outline" size="sm" onClick={() => onGenerate(expr.expression)}>
//                               Generate
//                             </Button>
//                             <Button variant="outline" size="sm" onClick={() => onFixIt(expr.expression)}>
//                               Fix it
//                             </Button>
//                           </div>
//                         </PopoverContent>
//                       </Popover>
//                     </div>
//                   )}
//                 </TableCell>
//                 <TableCell className="px-4 py-2 text-right">
//                   {editingIndex === index ? (
//                     <Button variant="ghost" size="sm" onClick={() => handleSave(index)}>
//                       <Check className="h-4 w-4 text-green-500" />
//                     </Button>
//                   ) : (
//                     <div className="flex justify-end space-x-2">
//                       <Button variant="ghost" size="sm" onClick={() => handleEdit(index)}>
//                         <Edit className="h-4 w-4 text-black-500" />
//                       </Button>
//                       <Button variant="ghost" size="sm" onClick={() => onRemoveExpression(index)}>
//                         <Trash2 className="h-4 w-4 text-black-500" />
//                       </Button>
//                     </div>
//                   )}
//                 </TableCell>
//               </TableRow>
//             ))}
//           </TableBody>
//         </Table>
//       </TabsContent>
//     </Tabs>
//   );
// };

// export default ExpressionTabs;

import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../../@/components/ui/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../../@/components/ui/tabs";
import { Trash2, Edit, Check, MoreHorizontal } from 'lucide-react';
import { Input } from "../../../../../@/components/ui/input";
import { Button } from "../../../../../@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../../../../../@/components/ui/popover";

interface Expression {
  targetColumn: string;
  expression: string;
}

interface ExpressionTabsProps {
  expressions: Expression[];
  onUpdateExpression: (index: number, updatedExpression: Expression) => void;
  onRemoveExpression: (index: number) => void;
  activeTab: string;
  onTabChange: (value: string) => void;
  onAskAI: (expression: string) => void;
  onGenerate: (expression: string) => void;
  onFixIt: (expression: string) => void;
}

const ExpressionTabs: React.FC<ExpressionTabsProps> = ({
  expressions,
  onUpdateExpression,
  onRemoveExpression,
  activeTab,
  onTabChange,
  onAskAI,
  onGenerate,
  onFixIt
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedExpression, setEditedExpression] = useState<Expression | null>(null);

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditedExpression(expressions[index]);
  };

  const handleSave = (index: number) => {
    if (editedExpression) {
      onUpdateExpression(index, editedExpression);
      setEditingIndex(null);
      setEditedExpression(null);
    }
  };

  const handleInputChange = (field: 'targetColumn' | 'expression', value: string) => {
    if (editedExpression) {
      setEditedExpression({ ...editedExpression, [field]: value });
    }
  };

  return (
    <Tabs defaultValue="expressions" className="w-full" value={activeTab} onValueChange={onTabChange}>
      <TabsList className="flex justify-start w-full mb-4">
        <TabsTrigger
          value="expressions"
          className="px-6 py-2 font-semibold">
          Expression
        </TabsTrigger>
      </TabsList>

      <TabsContent value="expressions">
        <Table className="w-full border-collapse">
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-1/3 text-sm font-semibold text-gray-600 px-4 py-2 text-left">Target Column</TableHead>
              <TableHead className="w-1/2 text-sm font-semibold text-gray-600 px-4 py-2 text-left">Expression</TableHead>
              <TableHead className="w-1/6 text-sm font-semibold text-gray-600 px-4 py-2 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expressions.map((expr, index) => (
              <TableRow key={index} className="border-b border-gray-200 hover:bg-gray-50">
                <TableCell className="px-4 py-2">
                  {editingIndex === index ? (
                    <Input
                      value={editedExpression?.targetColumn || ''}
                      onChange={(e) => handleInputChange('targetColumn', e.target.value)}
                      className="text-sm"
                    />
                  ) : (
                    <span className="text-sm">{expr.targetColumn}</span>
                  )}
                </TableCell>
                <TableCell className="px-4 py-2">
                  {editingIndex === index ? (
                    <Input
                      value={editedExpression?.expression || ''}
                      onChange={(e) => handleInputChange('expression', e.target.value)}
                      className="text-sm"
                    />
                  ) : (
                    <div className="flex items-center space-x-2">
                      <code className="text-sm bg-gray-100 rounded px-2 py-1 flex-grow">{expr.expression}</code>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <div className="flex space-x-1 p-1">
                            <Button variant="outline" size="sm" onClick={() => onAskAI(expr.expression)}>
                              Ask AI
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => onGenerate(expr.expression)}>
                              Generate
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => onFixIt(expr.expression)}>
                              Fix it
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </TableCell>
                <TableCell className="px-4 py-2 text-right">
                  {editingIndex === index ? (
                    <Button variant="ghost" size="sm" onClick={() => handleSave(index)}>
                      <Check className="h-4 w-4 text-green-500" />
                    </Button>
                  ) : (
                    <div className="flex justify-end space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(index)}>
                        <Edit className="h-4 w-4 text-black-500" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onRemoveExpression(index)}>
                        <Trash2 className="h-4 w-4 text-black-500" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TabsContent>
    </Tabs>
  );
};

export default ExpressionTabs;
