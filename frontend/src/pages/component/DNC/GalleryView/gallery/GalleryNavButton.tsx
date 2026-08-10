import { Button } from '@/@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface GalleryNavButtonProps {
  direction: 'left' | 'right';
  onClick: () => void;
}

export function GalleryNavButton({ direction, onClick }: GalleryNavButtonProps) {
  const Icon = direction === 'left' ? ChevronLeft : ChevronRight;
  const position = direction === 'left' ? 'left-4' : 'right-4';

  return (
    <div className={`absolute inset-y-0 ${position} flex items-center`}>
      <Button
        variant="secondary"
        size="icon"
        className="rounded-full bg-background/80 backdrop-blur-sm hover:bg-background/90"
        onClick={onClick}
      >
        <Icon className="h-6 w-6" />
      </Button>
    </div>
  );
}