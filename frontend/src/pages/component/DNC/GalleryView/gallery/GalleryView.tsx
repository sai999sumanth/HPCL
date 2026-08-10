import { useState } from 'react';
import { GalleryNavButton } from './GalleryNavButton';
import { GalleryViewer } from './GalleryViewer';
import { GalleryThumbnailStrip } from './GalleryThumbnailStrip';
import type { CardData } from '@/types/dncCardData';

interface GalleryViewProps {
  cards: CardData[];
}

export function GalleryView({ cards }: GalleryViewProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const handlePrevious = () => {
    setActiveIndex((current) => (current === 0 ? cards.length - 1 : current - 1));
  };

  const handleNext = () => {
    setActiveIndex((current) => (current === cards.length - 1 ? 0 : current + 1));
  };

  const activeCard = cards[activeIndex];

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <div className="flex-1 relative">
        <GalleryViewer card={activeCard} />
        <GalleryNavButton direction="left" onClick={handlePrevious} />
        <GalleryNavButton direction="right" onClick={handleNext} />
      </div>
      
      <div className="h-20 border-t">
        <GalleryThumbnailStrip
          cards={cards}
          activeIndex={activeIndex}
          onSelect={setActiveIndex}
        />
      </div>
    </div>
  );
}