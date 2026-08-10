import { useState } from 'react';
import GridLayout from 'react-grid-layout';
import { GridItem } from './GridItem';
import type { Layout, ScreenItem } from '@/types/screen';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

interface ScreenLayoutProps {
  screens: ScreenItem[];
  onLayoutChange: (layout: Layout[]) => void;
  onDeleteScreen: (id: string) => void;
}

export function ScreenLayout({ screens, onLayoutChange, onDeleteScreen }: ScreenLayoutProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const handleToggleExpand = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const layout = screens.map((screen) => ({
    i: screen.id,
    x: screen.x,
    y: screen.y,
    w: expandedItems.has(screen.id) ? 12 : screen.w,
    h: expandedItems.has(screen.id) ? 6 : screen.h,
  }));

  return (
    <GridLayout
      className="layout"
      layout={layout}
      cols={12}
      rowHeight={100}
      width={1200}
      onLayoutChange={onLayoutChange}
      draggableHandle=".drag-handle"
      margin={[16, 16]}
    >
      {screens.map((screen) => (
        <div key={screen.id} data-grid-id={screen.id}>
          <GridItem
            item={{ ...screen, isExpanded: expandedItems.has(screen.id) }}
            onToggleExpand={handleToggleExpand}
            onDelete={onDeleteScreen}
          />
        </div>
      ))}
    </GridLayout>
  );
}