import { Card } from '@/@/components/ui/card';
import type { CardData } from '@/types/dncCardData';

interface GalleryViewerProps {
  card: CardData;
}

export function GalleryViewer({ card }: GalleryViewerProps) {
  return (
    <Card className="absolute inset-0 m-1 overflow-hidden">
      <iframe
        src={card.iframeSrc}
        title={card.title}
        className="w-full h-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </Card>
  );
}