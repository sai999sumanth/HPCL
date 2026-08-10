import { MonitorIcon, PlusCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card } from '@/@/components/ui/card';
import { Button } from '@/@/components/ui/button';
import { ScreenItem } from '@/types/screen';

interface SidebarItemProps {
  screen: ScreenItem;
  onAddToGrid: (screen: ScreenItem) => void;
}

export function SidebarItem({ screen, onAddToGrid }: SidebarItemProps) {
  return (
    <Card className="mb-3 overflow-hidden bg-card">
      <div className="p-2">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <MonitorIcon className="mt-1 h-5 w-5 text-muted-foreground" />
            <div>
              <h3 className="font-semibold">{screen.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                {screen.content}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onAddToGrid(screen)}
            className="shrink-0"
          >
            <PlusCircle className="h-5 w-5" />
          </Button>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>By {screen.createdBy}</span>
          <span>Updated {formatDistanceToNow(new Date(screen.updatedAt))} ago</span>
        </div>
      </div>
    </Card>
  );
}