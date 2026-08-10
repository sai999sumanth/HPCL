import {
  Maximize2,
  Minimize2,
  GripVertical,
  Trash2,
  MoreVertical,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/@/components/ui/dropdown-menu';
import type { ScreenItem } from '@/types/screen';
import { Card } from '@/@/components/ui/card';
import { Button } from '@/@/components/ui/button';

interface GridItemProps {
  item: ScreenItem;
  onToggleExpand: (id: string) => void;
  onDelete: (id: string) => void;
}

export function GridItem({ item, onToggleExpand, onDelete }: GridItemProps) {
  return (
    <Card className="h-full w-full overflow-hidden bg-card shadow-lg transition-shadow hover:shadow-xl">
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <GripVertical className="drag-handle h-5 w-5 cursor-move text-muted-foreground hover:text-foreground" />
          <h3 className="font-semibold">{item.title}</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleExpand(item.id)}
            className="hover:bg-accent/50"
          >
            {item.isExpanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="hover:bg-accent/50">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(item.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="p-4">
        <p className="text-muted-foreground">{item.content}</p>
      </div>
    </Card>
  );
}