import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import { X } from 'lucide-react';

// Import images
import infrastructureImg from '../../assets/hpcl/infraa.jpeg';
import operationsImg from '../../assets/hpcl/Misson60.png';
import performanceImg from '../../assets/hpcl/SalesPerformance.png';
import governanceImg from '../../assets/hpcl/IndustryPerformance.png';
import inventoryImg from '../../assets/hpcl/infraa.jpeg';
import customerImg from '../../assets/hpcl/ops.jpg';
import { Console } from 'console';
import { useNavigate } from 'react-router-dom';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/@/components/ui/breadcrumb';

interface CardProps {
  title: string;
  src: string;
  onOpen: () => void;
}

export function Card({ title, src, onOpen }: CardProps) {
  return (
    <div
      onClick={onOpen}
      className="group relative cursor-pointer rounded-xl h-64 transition-all duration-300 hover:scale-105"
    >
      {/* Card Container with Glassmorphism */}
      <div className="absolute inset-0 glass rounded-xl">
        <div className="p-6 h-full flex flex-col">
          {/* Image Container */}
          <div className="relative w-full h-40 mb-4 overflow-hidden rounded-lg">
            <img
              src={src}
              alt={title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
            />
          </div>
          
          {/* Title */}
          <h3 className="text-xl font-semibold text-black mt-auto">{title}</h3>
          
          {/* Maximize Icon */}
          <div className="absolute right-3 top-3 rounded-full bg-white/10 p-2 opacity-0 backdrop-blur-md shadow-md transition-opacity duration-300 group-hover:opacity-100 hover:bg-white/100 group-hover:text-black">
            <Maximize2 className="h-5 w-5 text-white hover:text-black" />
          </div>
        </div>
      </div>
    </div>
  );
}


interface FullscreenFrameProps {
  isOpen: boolean;
  title: string;
  url: string;
  onClose: () => void;
  slides: any[];
  sIndex: number;
}

export function FullscreenFrame({ 
  isOpen, 
  onClose, 
  title, 
  slides, 
  sIndex 
}: FullscreenFrameProps) {
  const [currentIndex, setCurrentIndex] = useState(sIndex - 1);
  
  // Reset current index when sIndex changes
  useEffect(() => {
    if (sIndex !== undefined) {
      setCurrentIndex(sIndex - 1);
    }
  }, [sIndex]);

  if (!isOpen) return null;

  const handlePrevious = () => {
    setCurrentIndex(current => 
      current === 0 ? slides.length - 1 : current - 1
    );
  };

  const handleNext = () => {
    setCurrentIndex(current => 
      current === slides.length - 1 ? 0 : current + 1
    );
  };

  const handleDotClick = (index: number) => {
    setCurrentIndex(index);
  };

  return (
    <div className="fixed shadow-lg inset-0 left-[1rem] top-14 z-50 flex flex-col bg-white/90 backdrop-blur-lg p-2">
      {/* Header */}
      <div className="flex items-center justify-between bg-gray-50 px-3 py-2">
        <h2 className="text-md font-semibold text-black">
          {slides[currentIndex]?.title || title}
        </h2>
        <button
          onClick={onClose}
          className="absolute right-4 top-3 z-10 rounded-full bg-black/50 p-2 text-white transition-all duration-300 hover:bg-black/100 hover:rotate-90 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="relative flex-1">
        <div className="h-full w-full">
          <iframe
            src={slides[currentIndex]?.iframeSrc}
            className="h-full w-full border-none bg-white rounded-md"
            title={`${slides[currentIndex]?.title} Content`}
          />
        </div>

        {/* Navigation Buttons */}
        <div className="absolute inset-y-0 left-0 flex items-center">
          <button
            onClick={handlePrevious}
            className="bg-black/50 text-white p-2 rounded-r-lg hover:bg-black/70 transition-colors"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        </div>
        <div className="absolute inset-y-0 right-0 flex items-center">
          <button
            onClick={handleNext}
            className="bg-black/50 text-white p-2 rounded-l-lg hover:bg-black/70 transition-colors"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>

        {/* Dot Indicators */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => handleDotClick(index)}
              className={`h-2 w-2 rounded-full transition-all ${
                index === currentIndex 
                  ? 'bg-white w-4' 
                  : 'bg-white/50 hover:bg-white/70'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface CardData {
  id: number;
  title: string;
  src: string;
  iframeSrc: string;
  redirectUrl: string;
}

const cards: CardData[] = [
  {
    id: 1,
    title: "Mission 60",
    src: operationsImg,
    iframeSrc: "/analytics-dnc#/report-viewer?dir=Mission60&file=M60_SalesPerformance.efwdd&mode=open&j_username=hiadmin&j_password=hiadmin",
    redirectUrl: "/analytics-dnc#/report-viewer?dir=Mission60&file=M60_SalesPerformance.efwdd&mode=open&j_username=hiadmin&j_password=hiadmin",
  },
  {
    id: 2,
    title: "Sales Performance",
    src: performanceImg,
    iframeSrc: "/analytics-dnc/#/report-viewer?dir=TIBCO&file=MOM_SALES_GROWTH_FY.efwdd&mode=open&j_username=hiadmin&j_password=hiadmin",
    redirectUrl: "/analytics-dnc/#/report-viewer?dir=TIBCO&file=MOM_SALES_GROWTH_FY.efwdd&mode=open&j_username=hiadmin&j_password=hiadmin",
  },
  // {
  //   id: 3,
  //   title: "Industry Performance",
  //   src: governanceImg,
  //   iframeSrc: "https://cems/web/",
  //   redirectUrl: "https://cems/web/",
  // }
];

const PerformancePage = () => {
  const [selectedFrame, setSelectedFrame] = useState<any | null>(null);
    const [title, setTitle] = useState<string | null>("");
    const navigate = useNavigate();
  
    function handleOpen(card) {
      setSelectedFrame(card);
      setTitle(card.title);
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white-300 to-gray-50">
        {/* <Header /> */}
        
          <Breadcrumb className="px-3 py-2">
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block cursor-pointer">
                <BreadcrumbLink onClick={() => navigate('/projects')}>
                  Home
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Performance</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb> 
  
        <main className="container mx-auto px-3 py-3">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <Card
                key={card.id}
                title={card.title}
                src={card.src}
                onOpen={() => handleOpen(card)}
              />
            ))}
          </div>
        </main>
  
        <FullscreenFrame
          isOpen={!!selectedFrame}
          url={selectedFrame || ''}
          title={title}
          onClose={() => setSelectedFrame(null)}
          slides={cards}
          sIndex={selectedFrame?.id}
        />
      </div>
    );
  }
  
export default PerformancePage;