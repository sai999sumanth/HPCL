import React from 'react';
import { Card, CardHeader, CardTitle } from "../../../../@/components/ui/card";
import {  AlignJustify, LayoutGrid, Heading, Type, Minus } from 'lucide-react';
// import { Tabs as TabsIcon } from 'lucide-react';
interface LayoutElementType {
  id: string;
  name: string;
  icon: React.ElementType;
}

interface LayoutElementsProps {
  onDragStart: (e: React.DragEvent<HTMLDivElement>, element: LayoutElementType) => void;
}

const layoutElementTypes: LayoutElementType[] = [
  { id: 'tabs', name: 'Tabs', icon: AlignJustify },
  { id: 'row', name: 'Row', icon: AlignJustify },
  { id: 'column', name: 'Column', icon: LayoutGrid },
  { id: 'header', name: 'Header', icon: Heading },
  { id: 'text', name: 'Text', icon: Type },
  { id: 'divider', name: 'Divider', icon: Minus },
];

const LayoutElements: React.FC<LayoutElementsProps> = ({ onDragStart }) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {layoutElementTypes.map((element) => (
          <Card
            key={element.id}
            className="cursor-move"
            draggable
            onDragStart={(e) => onDragStart(e, element)}
          >
            <CardHeader className="p-3">
              <CardTitle className="flex items-center">
                <element.icon className="mr-2" size={18} />
                {element.name}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default LayoutElements;