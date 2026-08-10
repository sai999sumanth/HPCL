import { Button } from '@/@/components/ui/button';
import type { CardData } from '@/types/dncCardData';

interface GalleryThumbnailProps {
  card: CardData;
  isActive: boolean;
  onClick: () => void;
}

export function GalleryThumbnail({ card, isActive, onClick }: GalleryThumbnailProps) {
  const Icon = card.src;
  
  return (
    // <Button
    //   variant={isActive ? "default" : "outline"}
    //   className={isActive ? "border-2 border-blue-400 w-full h-full" : "border-0 w-full h-full"}
    //   onClick={onClick}
    // >
    //   <div className="flex flex-col items-center justify-center space-y-2 w-full">
    //     <img src={Icon} className="w-full h-12" />
    //     <span className="text-xs font-bold text-black">{card.title}</span>
    //   </div>
    // </Button>
      <Button
        variant={isActive ? "default" : "outline"}
        className={isActive ? "hover-style h-auto border-none rounded-none bg-slate-800 flex flex-col items-center text-center p-3 hover-style" : "h-auto border-none rounded-none bg-slate-800 flex flex-col items-center text-center p-3 gradient-color"}
        onClick={onClick}
      >
        <img src={Icon} className="w-full h-24" />
        <h3 className="text-white font-bold">{card.title}</h3>
        <div className="mt-4 rounded-full border border-white p-2 hover:bg-slate-700 cursor-pointer">
          <svg
            className="w-4 h-4 text-slate-400"
            fill="none"
            stroke="#fff"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </Button>
  );
}

