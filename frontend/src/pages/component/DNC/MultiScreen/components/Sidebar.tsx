import { ChevronRight } from 'lucide-react';
import { SidebarItem } from './SidebarItem';
import { ScreenItem } from '@/types/screen';
import { Button } from '@/@/components/ui/button';
import { cn } from '@/@/lib/utils';
import { ScrollArea } from '@/@/components/ui/scroll-area';

interface SidebarProps {
  isCollapsed: boolean;
  screens: ScreenItem[];
  onToggle: () => void;
  onAddToGrid: (screen: ScreenItem) => void;
}

export function Sidebar({ isCollapsed, screens, onToggle, onAddToGrid }: SidebarProps) {
  return (
    <div
      className={cn(
        'flex h-full flex-col border-l bg-card transition-all duration-300',
        isCollapsed ? 'w-[50px]' : 'w-[350px]'
      )}
    >
      <div className="flex h-[60px] items-center justify-between border-b px-2">
        {!isCollapsed && <h2 className="text-lg font-semibold">Available Screens</h2>}
        <Button variant="ghost" size="icon" onClick={onToggle} className={cn(!isCollapsed && 'ml-auto')}>
          <ChevronRight
            className={cn('h-4 w-4 transition-all', isCollapsed ? 'rotate-180' : '')}
          />
        </Button>
      </div>
      {!isCollapsed && (
        <ScrollArea className="flex-1 p-4">
          {screens.map((screen) => (
            <SidebarItem
              key={screen.id}
              screen={screen}
              onAddToGrid={onAddToGrid}
            />
          ))}
        </ScrollArea>
      )}
    </div>
  );
}