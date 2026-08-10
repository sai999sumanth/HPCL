// import React, { useState } from 'react';
// import { Button } from "../../../../../@/components/ui/button";
// import { ChevronLeft, Edit } from 'lucide-react';
// import ColumnList from './ColumnList';
// import ExpressionTabs from './ExpressionTabs';

// interface Expression {
//   targetColumn: string;
//   expression: string;
// }

// interface ExpressionEditorProps {
//   isOpen: boolean;
//   onClose: () => void;
//   onSave: () => void;
//   dataset: string;
// }

// const ExpressionEditor: React.FC<ExpressionEditorProps> = ({ isOpen, onClose, onSave, dataset }) => {
//   const [activeTab, setActiveTab] = useState<string>("expressions");
//   const [expressions, setExpressions] = useState<Expression[]>([
//     { targetColumn: 'account_length_days', expression: 'datediff(current_date(), account_open_date)' },
//     { targetColumn: 'order_id', expression: 'order_id' },
//     { targetColumn: 'customer_id', expression: 'customer_id' },
//     { targetColumn: 'amount', expression: 'amount' },
//   ]);
//   const [isEditing, setIsEditing] = useState<boolean>(false);
//   const [title, setTitle] = useState<string>("Cleanup");
  
//   const handleRemoveExpression = (index: number) => {
//     const updatedExpressions = expressions.filter((_, i) => i !== index);
//     setExpressions(updatedExpressions);
//   };

//   const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     setTitle(e.target.value);
//   };

//   const toggleEditing = () => {
//     setIsEditing(!isEditing);
//   };

//   return (
//     <>
//       {isOpen && (
//         <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30"></div>
//       )}
      
//       <div
//         className={`fixed top-16 right-0 h-[calc(100%-4rem)] w-3/4 bg-white shadow-lg rounded-r-lg transition-transform duration-300 z-40 ${
//           isOpen ? 'translate-x-0' : 'translate-x-full'
//         }`}
//       >
//         <div className="flex items-center p-4 border-b">
//           <Button variant="ghost" size="sm" onClick={onClose} className="mr-3">
//             <ChevronLeft className="h-4 w-4" />
//           </Button>
//           {isEditing ? (
//             <input
//               type="text"
//               value={title}
//               onChange={handleTitleChange}
//               onBlur={() => setIsEditing(false)}
//               className="text-lg font-semibold border-b border-gray-300 focus:outline-none"
//               autoFocus
//             />
//           ) : (
//             <h2 className="text-lg font-semibold flex items-center">
//               {title}
//               <Button variant="ghost" size="sm" onClick={toggleEditing} className="ml-2">
//                 <Edit className="h-4 w-4" />
//               </Button>
//             </h2>
//           )}
//         </div>
//         <div className="flex h-[calc(100%-8rem)]">
//           <div className="w-1/3 p-4">
//             <ColumnList dataset={dataset} />
//           </div>
//           <div className="w-2/3 p-4 overflow-y-auto">
//             <ExpressionTabs
//               expressions={expressions}
//               onRemoveExpression={handleRemoveExpression}
//               activeTab={activeTab}
//               onTabChange={setActiveTab}
//             />
//           </div>
//         </div>
//         <div className="absolute bottom-0 left-0 right-0 flex justify-end p-4 border-t bg-white">
//           <Button variant="outline" size="sm" onClick={onClose} className="mr-3">Cancel</Button>
//           <Button size="sm" onClick={onSave}>Save</Button>
//         </div>
//       </div>
//     </>
//   );
// };

// export default ExpressionEditor;


// import React, { useState } from 'react';
// import { Button } from "../../../../../@/components/ui/button";
// import { ChevronLeft, Edit } from 'lucide-react';
// import ColumnList from './ColumnList';
// import ExpressionTabs from './ExpressionTabs';

// interface Expression {
//   targetColumn: string;
//   expression: string;
// }

// interface ExpressionEditorProps {
//   isOpen: boolean;
//   onClose: () => void;
//   onSave: () => void;
//   dataset: string;
// }

// const ExpressionEditor: React.FC<ExpressionEditorProps> = ({ isOpen, onClose, onSave, dataset }) => {
//   const [activeTab, setActiveTab] = useState<string>("expressions");
//   const [expressions, setExpressions] = useState<Expression[]>([]);
//   const [isEditing, setIsEditing] = useState<boolean>(false);
//   const [title, setTitle] = useState<string>("Cleanup");

//   const handleAddColumn = (columnName: string, columnType: string) => {
//     const newExpression: Expression = {
//       targetColumn: columnName,
//       expression: columnName // Default expression is just the column name
//     };
//     setExpressions([...expressions, newExpression]);
//   };

//   const handleRemoveExpression = (index: number) => {
//     const updatedExpressions = expressions.filter((_, i) => i !== index);
//     setExpressions(updatedExpressions);
//   };

//   const handleUpdateExpression = (index: number, updatedExpression: Expression) => {
//     const newExpressions = [...expressions];
//     newExpressions[index] = updatedExpression;
//     setExpressions(newExpressions);
//   };

//   const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     setTitle(e.target.value);
//   };

//   const toggleEditing = () => {
//     setIsEditing(!isEditing);
//   };

//   return (
//     <>
//       {isOpen && (
//         <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30"></div>
//       )}
      
//       <div
//         className={`fixed top-16 right-0 h-[calc(100%-4rem)] w-3/4 bg-white shadow-lg rounded-r-lg transition-transform duration-300 z-40 ${
//           isOpen ? 'translate-x-0' : 'translate-x-full'
//         }`}
//       >
//         <div className="flex items-center p-4 border-b">
//           <Button variant="ghost" size="sm" onClick={onClose} className="mr-3">
//             <ChevronLeft className="h-4 w-4" />
//           </Button>
//           {isEditing ? (
//             <input
//               type="text"
//               value={title}
//               onChange={handleTitleChange}
//               onBlur={() => setIsEditing(false)}
//               className="text-lg font-semibold border-b border-gray-300 focus:outline-none"
//               autoFocus
//             />
//           ) : (
//             <h2 className="text-lg font-semibold flex items-center">
//               {title}
//               <Button variant="ghost" size="sm" onClick={toggleEditing} className="ml-2">
//                 <Edit className="h-4 w-4" />
//               </Button>
//             </h2>
//           )}
//         </div>
//         <div className="flex h-[calc(100%-8rem)]">
//           <div className="w-1/3 p-4">
//             <ColumnList dataset={dataset} onAddColumn={handleAddColumn} />
//           </div>
//           <div className="w-2/3 p-4 overflow-y-auto">
//             <ExpressionTabs
//               expressions={expressions}
//               onRemoveExpression={handleRemoveExpression}
//               onUpdateExpression={handleUpdateExpression}
//               activeTab={activeTab}
//               onTabChange={setActiveTab}
//             />
//           </div>
//         </div>
//         <div className="absolute bottom-0 left-0 right-0 flex justify-end p-4 border-t bg-white">
//           <Button variant="outline" size="sm" onClick={onClose} className="mr-3">Cancel</Button>
//           <Button size="sm" onClick={onSave}>Save</Button>
//         </div>
//       </div>
//     </>
//   );
// };

// export default ExpressionEditor;
import React, { useState } from 'react';
import { Button } from "../../../../../@/components/ui/button";
import { ChevronLeft, Edit } from 'lucide-react';
import ColumnList from './ColumnList';
import ExpressionTabs from './ExpressionTabs';

interface Expression {
  targetColumn: string;
  expression: string;
}

interface ExpressionEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  dataset: string;
}

const ExpressionEditor: React.FC<ExpressionEditorProps> = ({ isOpen, onClose, onSave, dataset }) => {
  const [activeTab, setActiveTab] = useState<string>("expressions");
  const [expressions, setExpressions] = useState<Expression[]>([]);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [title, setTitle] = useState<string>("Cleanup");

  const handleAddColumn = (columnName: string, columnType: string) => {
    const newExpression: Expression = {
      targetColumn: columnName,
      expression: columnName // Default expression is just the column name
    };
    setExpressions([...expressions, newExpression]);
  };

  const handleRemoveExpression = (index: number) => {
    const updatedExpressions = expressions.filter((_, i) => i !== index);
    setExpressions(updatedExpressions);
  };

  const handleUpdateExpression = (index: number, updatedExpression: Expression) => {
    const newExpressions = [...expressions];
    newExpressions[index] = updatedExpression;
    setExpressions(newExpressions);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  const toggleEditing = () => {
    setIsEditing(!isEditing);
  };

  // Add these new handler functions
  const handleAskAI = (expression: string) => {
    console.log("Ask AI for:", expression);
    // Implement the logic to ask AI
  };

  const handleGenerate = (expression: string) => {
    console.log("Generate for:", expression);
    // Implement the logic to generate
  };

  const handleFixIt = (expression: string) => {
    console.log("Fix:", expression);
    // Implement the logic to fix the expression
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30"></div>
      )}
      
      <div
        className={`fixed top-16 right-0 h-[calc(100%-4rem)] w-3/4 bg-white shadow-lg rounded-r-lg transition-transform duration-300 z-40 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center p-4 border-b">
          <Button variant="ghost" size="sm" onClick={onClose} className="mr-3">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {isEditing ? (
            <input
              type="text"
              value={title}
              onChange={handleTitleChange}
              onBlur={() => setIsEditing(false)}
              className="text-lg font-semibold border-b border-gray-300 focus:outline-none"
              autoFocus
            />
          ) : (
            <h2 className="text-lg font-semibold flex items-center">
              {title}
              <Button variant="ghost" size="sm" onClick={toggleEditing} className="ml-2">
                <Edit className="h-4 w-4" />
              </Button>
            </h2>
          )}
        </div>
        <div className="flex h-[calc(100%-8rem)]">
          <div className="w-1/3 p-4">
            <ColumnList dataset={dataset} onAddColumn={handleAddColumn} />
          </div>
          <div className="w-2/3 p-4 overflow-y-auto">
            <ExpressionTabs
              expressions={expressions}
              onRemoveExpression={handleRemoveExpression}
              onUpdateExpression={handleUpdateExpression}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onAskAI={handleAskAI}
              onGenerate={handleGenerate}
              onFixIt={handleFixIt}
            />
          </div>
        </div>   
        <div className="absolute bottom-0 left-0 right-0 flex justify-end p-4 border-t bg-white space-x-2">
        <button
          onClick={onClose}
          className="bg-white-300 text-gray-700 px-2 py-1 text-xs rounded shadow-md"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          className="bg-[#682a7a] hover:bg-[#562362] text-white px-2 py-1 text-xs rounded flex items-center mr-2"
        >
          Save
        </button>
      </div>

      </div>
    </>
  );
};

export default ExpressionEditor;