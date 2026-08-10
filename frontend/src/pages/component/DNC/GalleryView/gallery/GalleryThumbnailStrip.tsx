import { Button } from '@/@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { GalleryThumbnail } from './GalleryThumbnail';
import type { CardData } from '@/types/dncCardData';

interface GalleryThumbnailStripProps {
  cards: CardData[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

export function GalleryThumbnailStrip({
  cards,
  activeIndex,
  onSelect,
}: GalleryThumbnailStripProps) {
  const visibleCount = 6; // Reduced to make room for navigation buttons
  const startIndex = Math.max(
    0,
    Math.min(
      activeIndex - Math.floor(visibleCount / 2),
      cards.length - visibleCount
    )
  );

  const handlePrevious = () => {
    onSelect(activeIndex === 0 ? cards.length - 1 : activeIndex - 1);
  };

  const handleNext = () => {
    onSelect(activeIndex === cards.length - 1 ? 0 : activeIndex + 1);
  };

  const visibleCards = cards.slice(startIndex, startIndex + visibleCount);

  return (
    <div className="flex items-center justify-between h-full gap-2 px-4">
      <Button
        variant="outline"
        size="sm"
        className="h-full aspect-square shrink-0"
        onClick={handlePrevious}
      >
        <ChevronLeft className="h-6 w-6" />
      </Button>

      <div className="flex-1 grid grid-cols-6 gap-0 h-full">
        {visibleCards.map((card, index) => (
          <GalleryThumbnail
            key={card.id}
            card={card}
            isActive={startIndex + index === activeIndex}
            onClick={() => onSelect(startIndex + index)}
          />
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="h-full aspect-square shrink-0"
        onClick={handleNext}
      >
        <ChevronRight className="h-6 w-6" />
      </Button>
    </div>
  );
}