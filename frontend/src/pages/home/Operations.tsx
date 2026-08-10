// import React, { useState } from 'react';
// import { Card, CardContent, CardHeader, CardTitle } from '../../@/components/ui/card';
import SpotFire from '../../assets/hpcl/spotfire.png';
import VA from '../../assets/hpcl/VA.png';
import VTS from '../../assets/hpcl/VTS.png';
import CEMS from '../../assets/hpcl/CEMS.jpeg';
import REFINARY from '../../assets/hpcl/REFINARY.jpeg';
import SUPPLY_CHAIN from '../../assets/hpcl/SUPPLY_CHAIN.png';
import EMLOCK from '../../assets/hpcl/EMLOCK.png';
import SALESCDCEMS from '../../assets/hpcl/SALESCDCEMS.png';
// import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../@/components/ui/dialog';
// import { Button } from '../../@/components/ui/button';
// // import { VisuallyHidden } from '@chakra-ui/react';
// import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
// import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/@/components/ui/breadcrumb';
// import { useDispatch } from 'react-redux';
// import { useNavigate } from 'react-router-dom';

// const HomePage = () => {
//   const navigate = useNavigate();
//   const [isDialogOpen, setIsDialogOpen] = useState(false);
//   const [url, setUrl] = useState('');
  
//   const openDashboard = (url: string) => {
//     // window.open(url, "_blank");
//     setIsDialogOpen(true);
//     setUrl(url);
//   };

//   const cards = [
//     {
//       id: 2,
//       title: "VA",
//       src: VA,
//       iframeSrc: "https://va.hpcl.co.in/login",
//       redirectUrl: "https://va.hpcl.co.in/login",
//     },
//     {
//       id: 1,
//       title: "VTS",
//       src: VTS,
//       iframeSrc: "https://hpclvts.hpcl.co.in/",
//       redirectUrl: "https://hpclvts.hpcl.co.in/",
//     },
//     {
//       id: 3,
//       title: "CEMS",
//       src: CEMS,
//       iframeSrc: "https://cems/web/",
//       redirectUrl: "https://cems/web/",
//     },
//     {
//       id: 4,
//       title: "REFINARY",
//       src: REFINARY,
//       iframeSrc: "https://cems/web/",
//       redirectUrl: "https://cems/web/",
//     },
//     {
//       id: 5,
//       title: "EMLOCK",
//       src: EMLOCK,
//       iframeSrc: "https://algo-ceg-dev.analytics.algofusiontech.com/superset/dashboard/b2df8e09-6cd5-4ff5-a37d-6f75c21694d6/?native_filters_key=y_RAgxzxpVVw7PIZNxhSEn1C1hZSVHkKcvegvmL20Wr3aQMVjdTSzpqSQsjJeCKL",
//       redirectUrl: "https://algo-ceg-dev.analytics.algofusiontech.com/superset/dashboard/b2df8e09-6cd5-4ff5-a37d-6f75c21694d6/?native_filters_key=y_RAgxzxpVVw7PIZNxhSEn1C1hZSVHkKcvegvmL20Wr3aQMVjdTSzpqSQsjJeCKL",
//     },
//     {
//       id: 6,
//       title: "SUPPLY CHAIN",
//       src: SUPPLY_CHAIN,
//       iframeSrc: '/superset/dashboard/p/yaD4Ar6mOP2/',
//       redirectUrl: '/superset/dashboard/p/yaD4Ar6mOP2/',
//       // iframeSrc: "https://algo-ceg-dev.analytics.algofusiontech.com/superset/dashboard/b2df8e09-6cd5-4ff5-a37d-6f75c21694d6/?native_filters_key=y_RAgxzxpVVw7PIZNxhSEn1C1hZSVHkKcvegvmL20Wr3aQMVjdTSzpqSQsjJeCKL",
//       // redirectUrl: "https://algo-ceg-dev.analytics.algofusiontech.com/superset/dashboard/b2df8e09-6cd5-4ff5-a37d-6f75c21694d6/?native_filters_key=y_RAgxzxpVVw7PIZNxhSEn1C1hZSVHkKcvegvmL20Wr3aQMVjdTSzpqSQsjJeCKL",
//     },
//   ];

//   function handleRoute() {
//     navigate('/projects');
//   }

//   return (
//     <>
//       <Breadcrumb>
//         <BreadcrumbList>
//           <BreadcrumbItem className="hidden md:block">
//             <BreadcrumbLink onClick={handleRoute}>
//               Home
//             </BreadcrumbLink>
//           </BreadcrumbItem>
//           <BreadcrumbSeparator className="hidden md:block" />
//           <BreadcrumbItem>
//             <BreadcrumbPage>Data Fetching</BreadcrumbPage>
//           </BreadcrumbItem>
//         </BreadcrumbList>
//       </Breadcrumb>
//     <div className="grid grid-cols-2 gap-6 p-6">
//       {cards.map((card) => (
//         <Card
//           key={card.id}
//           className="relative group w-full overflow-hidden border border-gray-200 shadow-lg rounded-lg transition-transform duration-300 hover:scale-105"
//         >
//           <CardHeader className="px-4 py-2 bg-gray-200 text-gray-800">
//             <CardTitle className="text-md font-semibold">{card.title}</CardTitle>
//           </CardHeader>
//           <CardContent className="relative p-4" onClick={() => openDashboard(card.redirectUrl)}>
//             {
//               card.src ? (
//                 <img
//                   src={card.src}
//                   alt="Spotfire"
//                   className="object-cover w-full h-full"
//                 />
//               ) : ( 
//                 <iframe
//                 src={card.iframeSrc}
//                 width="100%"
//                 height="400px"
//                 className="rounded-lg shadow-md"
//                 title={card.title}
//                 ></iframe>
//               )
//             }
            
//             {/* Blur and "Show More" on hover */}
//             <div className="absolute inset-0 bg-black bg-opacity-40 backdrop-blur-xs flex flex-col justify-center items-center opacity-0 group-hover:opacity-50 transition-opacity duration-300">
//               {/* <button
//                 onClick={() => openDashboard(card.redirectUrl)}
//                 className="px-4 py-2 bg-blue-400 text-white rounded-lg hover:bg-blue-500"
//               >
//                 Open
//               </button> */}
//             </div>
//           </CardContent>
//         </Card>
//       ))}
//     </div>

     
//     <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>      
//       <DialogContent className="max-w-[95vw] h-[83%]">
//         <VisuallyHidden>
//           <DialogTitle>Title</DialogTitle>
//         </VisuallyHidden>
//         {/* <DialogHeader className='p-0'></DialogHeader> */}
//         <div className="py-4">
//           <iframe 
//             src={url}
//             width="100%"
//             className="h-[80%]"
//           ></iframe>
//         </div>
//       </DialogContent>
//     </Dialog>
//     </>
//   );
// };

// export default HomePage;

// import React, { useState } from 'react';
// import { Card, CardContent, CardHeader, CardTitle } from '../../@/components/ui/card';
// import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '../../@/components/ui/carousel';
// import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../@/components/ui/dialog';
// import { Label } from '../../@/components/ui/label';
// import { Button } from '../../@/components/ui/button';
// import SpotFire from '../../assets/hpcl/spotfire.png';

// const Operations = () => {
//   const [isDialogOpen, setIsDialogOpen] = useState(false);
//   const [url, setUrl] = useState('');
  
//   const openDashboard = (url: string) => {
//     // window.open(url, "_blank");
//     setUrl(url);
//     setIsDialogOpen(true);
//   };

//   const cards = [
//     // {
//     //   id: 1,
//     //   title: "CRIS",
//     //   iframeSrc: "https://va.hpcl.co.in/login",
//     //   redirectUrl: "https://va.hpcl.co.in/login",
//     // },
//     {
//       id: 2,
//       title: "VA",
//       iframeSrc: "https://va.hpcl.co.in/login",
//       redirectUrl: "https://va.hpcl.co.in/login",
//     },
//     {
//       id: 3,
//       title: "Spotfire",
//       iframeSrc: "../../assets/hpcl/spotfire.png",
//       // iframeSrc: "https://va.hpcl.co.in/login",
//       redirectUrl: "https://hpclvts.hpcl.co.in/",
//     },
//     {
//       id: 4,
//       title: "CEMS",
//       iframeSrc: "https://cems/web/",
//       redirectUrl: "https://cems/web/",
//     },
//   ];

//   return (
//     // <div className="grid grid-cols-2 gap-6 p-6">
//     //   {cards.map((card) => (
//     //     <Card
//     //       key={card.id}
//     //       className="relative group w-full overflow-hidden border border-gray-200 shadow-lg rounded-lg transition-transform duration-300 hover:scale-105"
//     //     >
//     //       <CardHeader className="px-4 py-2 bg-gray-200 text-gray-800">
//     //         <CardTitle className="text-md font-semibold">{card.title}</CardTitle>
//     //       </CardHeader>
//     //       <CardContent className="relative p-4">
//     //         <iframe
//     //           src={card.iframeSrc}
//     //           width="100%"
//     //           height="200px"
//     //           className="rounded-lg shadow-md"
//     //           title={card.title}
//     //         ></iframe>
//     //         {/* Blur and "Show More" on hover */}
//     //         <div className="absolute inset-0 bg-black bg-opacity-40 backdrop-blur-xs flex flex-col justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
//     //           <button
//     //             onClick={() => openDashboard(card.redirectUrl)}
//     //             className="px-4 py-2 bg-blue-400 text-white rounded-lg hover:bg-blue-500"
//     //           >
//     //             Show More
//     //           </button>
//     //         </div>
//     //       </CardContent>
//     //     </Card>
//     //   ))}
//     // </div>
//     <>
//     <div className="container flex min-h-[350px] w-full justify-center px-[4rem] items-center">
//       <Carousel className="w-full">
//         <CarouselContent>
//           {cards.map((card, index) => (
//             <CarouselItem key={index}>
//               <div className="p-1">
//                 <Card className="relative group w-full overflow-hidden border border-gray-200 shadow-lg rounded-lg transition-transform duration-300 hover:scale-105">
//                   <CardContent className="flex h-screen items-center justify-center p-6">
//                     {
//                       card.title !== "Spotfire" ? ( 
//                         <iframe
//                           src={card.iframeSrc}
//                           width="100%"
//                           height="100%"
//                           className="rounded-lg shadow-md"
//                           title={card.title}
//                         ></iframe>
//                       ) : (
//                         <img
//                           src={SpotFire}
//                           alt={card.title}
//                           className="w-full h-full object-cover rounded-lg shadow-md"
//                         />
//                       )
//                     }
//                     {/* <iframe
//                       src={card.iframeSrc}
//                       width="100%"
//                       height="100%"
//                       className="rounded-lg shadow-md"
//                       title={card.title}
//                     ></iframe> */}
//                     {/* Blur and "Show More" on hover */}
//                     <div className="absolute inset-0 bg-black bg-opacity-40 backdrop-blur-xs flex flex-col justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
//                       <button
//                         onClick={() => openDashboard(card.redirectUrl)}
//                         className="px-4 py-2 bg-blue-400 text-white rounded-lg hover:bg-blue-500"
//                       >
//                         Open
//                       </button>
//                     </div>
//                   </CardContent>
//                 </Card>
//               </div>
//             </CarouselItem>
//           ))}
//         </CarouselContent>
//         <CarouselPrevious />
//         <CarouselNext />
//       </Carousel>
//     </div>

//     <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
//       <DialogContent className="max-w-[1200px] h-[83%]">
//         <DialogHeader>
//           <DialogTitle>Edit profile</DialogTitle>
//           <DialogDescription>
//             Make changes to your profile here. Click save when you're done.
//           </DialogDescription>
//         </DialogHeader>
//         <div className="py-4">
//           <iframe
//             src={url}
//             width="100%"
//             height="100%"
//             className="rounded-lg shadow-md"
//           ></iframe>
//         </div>
//         <DialogFooter>
//           <Button type="submit">Close</Button>
//         </DialogFooter>
//       </DialogContent>
//     </Dialog>

//     </>
//   );
// };

// export default Operations;





import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import { X } from 'lucide-react';
import { Header } from '@/@/components/ui/header';
import { useNavigate } from 'react-router-dom';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/@/components/ui/breadcrumb';
import { toggleSidebar } from '@/redux/features/sidebarSlice';
import { useDispatch } from 'react-redux';

// import '../css/embla.css';

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
  options: any;
  slides: any[];
  sIndex: number;
}

// export function FullscreenFrame({ isOpen, onClose, title, options, slides, sIndex }: FullscreenFrameProps) {

//   const [emblaRef, emblaApi] = useEmblaCarousel(options, [Fade()]);
//   let { selectedIndex, scrollSnaps, onDotButtonClick } = useDotButton(emblaApi);

//   const {
//     prevBtnDisabled,
//     nextBtnDisabled,
//     onPrevButtonClick,
//     onNextButtonClick
//   } = usePrevNextButtons(emblaApi)
  
//   if (!isOpen) return null;
//   if(sIndex != null) {
//     // (selectedIndex = sIndex)
//   } else {
//     sIndex = null;
//   }

//   return (
//     <div className="fixed shadow-lg inset-0 left-[7rem] top-14 z-50 flex flex-col bg-white/90 backdrop-blur-lg p-2">
//       {/* Header */}
//       <div className="flex items-center justify-between bg-gray-50 px-3 py-2">
//         <h2 className="text-md font-semibold text-black">{title}</h2> {sIndex} : {selectedIndex}
//         <button
//           onClick={onClose}
//           className="absolute right-4 top-3 z-10 rounded-full bg-black/50 p-2 text-white transition-all duration-300 hover:bg-black/100 hover:rotate-90 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/50"
//         >
//           <X className="h-4 w-4" />
//         </button>
//       </div>

//       {/* Content with top spacing */}
//       {/* <div className="flex-1"> */}
//         <div className="embla">
//           <div className="embla__viewport" ref={emblaRef}>
//             <div className="embla__container">
//               {slides.map((item, index) => (
//                 <div className="embla__slide flex-1" key={item.id}>
//                   <iframe
//                     src={slides[sIndex].iframeSrc}
//                     className="h-full w-full border-none bg-white rounded-md"
//                     title="External Content"
//                   />
//                 </div>
//               ))}
//             </div>
//           </div>

//           <div className="embla__controls">
//             <div className="embla__buttons">
//               <PrevButton onClick={onPrevButtonClick} disabled={prevBtnDisabled} />
//               <NextButton onClick={onNextButtonClick} disabled={nextBtnDisabled} />
//             </div>

//             <div className="embla__dots">
//               {scrollSnaps.map((_, index) => (
//                 <DotButton
//                   key={index}
//                   onClick={() => onDotButtonClick(index)}
//                   className={'embla__dot'.concat(
//                     index === selectedIndex ? ' embla__dot--selected' : ''
//                   )}
//                 />
//               ))}
//             </div>
//           </div>
//         </div>
//         {
//           sIndex = null
//         }
//       {/* </div> */}
//       {/* <div className="flex-1">
//         <iframe
//           src={url}
//           className="h-full w-full border-none bg-white rounded-md"
//           title="External Content"
//         />
//       </div> */}
//     </div>
//   );
// }

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
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            loading="lazy" 
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
  isRoute: boolean;
  routingURL: string;
  iframeSrc: string;
  redirectUrl: string;
}

const cards: CardData[] = [
  {
    id: 1,
    title: "VA",
    src: VA,
    isRoute: false,
    routingURL: '',
    iframeSrc: "https://va.hpcl.co.in/login",
    redirectUrl: "https://va.hpcl.co.in/login",
  },
  {
    id: 2,
    title: "VTS",
    src: VTS,
    isRoute: false,
    routingURL: '',
    iframeSrc: "https://hpclvts.hpcl.co.in/",
    redirectUrl: "https://hpclvts.hpcl.co.in/",
  },
  {
    id: 3,
    title: "CEMS",
    src: CEMS,
    isRoute: false,
    routingURL: '',
    iframeSrc: "https://cems/web/",
    redirectUrl: "https://cems/web/",
  },
  {
    id: 4,
    title: "REFINERY",
    src: REFINARY,
    isRoute: false,
    routingURL: '',
    iframeSrc: "https://cems/web/",
    redirectUrl: "https://cems/web/",
  },
  {
    id: 5,
    title: "EMLOCK",
    src: EMLOCK,
    isRoute: false,
    routingURL: '',
    iframeSrc: "https://ttlssternaeml.hpcl.co.in/",
    redirectUrl: "https://ttlssternaeml.hpcl.co.in/",
  },
  {
    id: 6,
    title: "SUPPLY CHAIN",
    src: SUPPLY_CHAIN,
    isRoute: true,
    routingURL: '/supplychain/dashboard',
    iframeSrc: '/superset/dashboard/p/yaD4Ar6mOP2/',
    redirectUrl: '/superset/dashboard/p/yaD4Ar6mOP2/',
  },
  {
    id: 7,
    title: "LPG PLANT",
    src: SUPPLY_CHAIN,
    isRoute: true,
    routingURL: '/LPG/plantDashboard',
    iframeSrc: '/analytics-dnc/#/report-viewer?dir=LPG&file=LPG_Dashboard_02.efwdd&mode=open&j_username=hiadmin&j_password=hiadmin',
    redirectUrl: '/analytics-dnc/#/report-viewer?dir=LPG&file=LPG_Dashboard_02.efwdd&mode=open&j_username=hiadmin&j_password=hiadmin',
  },
  {
    id: 8,
    title: "LPG SALES CDCMS",
    src: SALESCDCEMS,
    isRoute: true,
    routingURL: '/LPG/salesDashboard',
    iframeSrc: '/superset/dashboard/p/Vjb7En142Ne/',
    redirectUrl: '/superset/dashboard/p/Vjb7En142Ne/',
  },
  // {
  //   id: 9,
  //   title: "CDCMS",
  //   src: SUPPLY_CHAIN,
  //   isRoute: true,
  //   routingURL: '/LPG/CDCMS',
  //   iframeSrc: '/analytics-dnc/#/report-viewer?dir=CDCMS&file=CDCMS_DASHBOARD_01.efwdd&mode=open&j_username=hiadmin&j_password=hiadmin',
  //   redirectUrl: '/analytics-dnc/#/report-viewer?dir=CDCMS&file=CDCMS_DASHBOARD_01.efwdd&mode=open&j_username=hiadmin&j_password=hiadmin',
  // },
  // {
  //   id: 10,
  //   title: "LPG ",
  //   src: SUPPLY_CHAIN,
  //   isRoute: false,
  //   routingURL: '',
  //   iframeSrc: '/analytics-dnc/#/report-viewer?dir=LPG&file=LPG_Dashboard_02.efwdd&mode=open&j_username=hiadmin&password=hiadmin',
  //   redirectUrl: '/analytics-dnc/#/report-viewer?dir=LPG&file=LPG_Dashboard_02.efwdd&mode=open&j_username=hiadmin&password=hiadmin',
  // },
  // {
  //   id: 11,
  //   title: "LPG 1",
  //   src: SUPPLY_CHAIN,
  //   isRoute: false,
  //   routingURL: '',
  //   iframeSrc: '/analytics-dnc/#/report-viewer?dir=LPG&file=LPG_Dashboard_1.efwdd&mode=open&j_username=hiadmin&password=hiadmin',
  //   redirectUrl: '/analytics-dnc/#/report-viewer?dir=LPG&file=LPG_Dashboard_1.efwdd&mode=open&j_username=hiadmin&password=hiadmin',
  // },
  {
    id: 12,
    title: "LUBES INVENTORY",
    src: SUPPLY_CHAIN,
    isRoute: false,
    routingURL: '',
    iframeSrc: '/analytics-dnc/#/report-viewer?dir=LubesInventory_03&file=Lubes_Sales_Dashboard_New.efwdd&mode=open',
    redirectUrl: '/analytics-dnc/#/report-viewer?dir=LubesInventory_03&file=Lubes_Sales_Dashboard_New.efwdd&mode=open',
  },
];

function Operations() {
  const [selectedFrame, setSelectedFrame] = useState<any | null>(null);
  const [title, setTitle] = useState<string | null>("");
  const navigate = useNavigate();
  const OPTIONS: any = { loop: true, duration: 30 };
  const dispatch = useDispatch();

  function handleOpen(card) {
    if(card.isRoute) {
      navigate(card.routingURL);
      dispatch(toggleSidebar());
    } else {
      setSelectedFrame(card);
      setTitle(card.title);
      dispatch(toggleSidebar());
    }
    
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
            <BreadcrumbPage>Operation</BreadcrumbPage>
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
        options={OPTIONS}
        sIndex={selectedFrame?.id}
      />
    </div>
  );
}

export default Operations;










// import React, { useState } from 'react';
// import { Maximize2, X } from 'lucide-react';
// import { useNavigate } from 'react-router-dom';
// import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/@/components/ui/breadcrumb';
// import useEmblaCarousel from 'embla-carousel-react';
// import Fade from 'embla-carousel-fade';
// import { EmblaOptionsType } from 'embla-carousel';
// import { NextButton, PrevButton, usePrevNextButtons } from './EmblaCarouselArrowButtons';
// import { DotButton, useDotButton } from './EmblaCarouselDotButtons';

// interface CardProps {
//   title: string;
//   src: string;
//   onOpen: () => void;
// }

// export function Card({ title, src, onOpen }: CardProps) {
//   return (
//     <div
//       onClick={onOpen}
//       className="group relative cursor-pointer rounded-xl h-64 transition-all duration-300 hover:scale-105"
//     >
//       <div className="absolute inset-0 glass rounded-xl">
//         <div className="p-6 h-full flex flex-col">
//           <div className="relative w-full h-40 mb-4 overflow-hidden rounded-lg">
//             <img
//               src={src}
//               alt={title}
//               className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
//             />
//           </div>
          
//           <h3 className="text-xl font-semibold text-black mt-auto">{title}</h3>
          
//           <div className="absolute right-3 top-3 rounded-full bg-white/10 p-2 opacity-0 backdrop-blur-md shadow-md transition-opacity duration-300 group-hover:opacity-100 hover:bg-white/100 group-hover:text-black">
//             <Maximize2 className="h-5 w-5 text-white hover:text-black" />
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// interface FullscreenFrameProps {
//   isOpen: boolean;
//   title: string;
//   onClose: () => void;
//   options: EmblaOptionsType;
//   slides: CardData[];
//   selectedIndex: number;
// }

// export function FullscreenFrame({ isOpen, onClose, title, options, slides, selectedIndex }: FullscreenFrameProps) {
//   const [emblaRef, emblaApi] = useEmblaCarousel(options, [Fade()]);
//   const { selectedIndex: dotIndex, scrollSnaps, onDotButtonClick } = useDotButton(emblaApi);
//   const {
//     prevBtnDisabled,
//     nextBtnDisabled,
//     onPrevButtonClick,
//     onNextButtonClick
//   } = usePrevNextButtons(emblaApi)

//   // Scroll to initial slide when component mounts
//   React.useEffect(() => {
//     if (emblaApi) {
//       emblaApi.scrollTo(selectedIndex);
//     }
//   }, [emblaApi, selectedIndex]);

//   if (!isOpen) return null;

//   return (
//     <div className="fixed shadow-lg inset-0 left-[7rem] top-14 z-50 flex flex-col bg-white/90 backdrop-blur-lg p-2">
//       <div className="flex items-center justify-between bg-gray-50 px-3 py-2">
//         <h2 className="text-md font-semibold text-black">{title}</h2>
//         <button
//           onClick={onClose}
//           className="absolute right-4 top-3 z-10 rounded-full bg-black/50 p-2 text-white transition-all duration-300 hover:bg-black/100 hover:rotate-90 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/50"
//         >
//           <X className="h-4 w-4" />
//         </button>
//       </div>

//       <div className="flex-1">
//         <div className="embla h-full">
//           <div className="embla__viewport h-full" ref={emblaRef}>
//             <div className="embla__container h-full">
//               {slides.map((slide) => (
//                 <div className="embla__slide h-full" key={slide.id}>
//                   <iframe
//                     src={slide.iframeSrc}
//                     className="h-full w-full border-none bg-white rounded-md"
//                     title={slide.title}
//                   />
//                 </div>
//               ))}
//             </div>
//           </div>

//           <div className="embla__controls">
//             <div className="embla__buttons">
//               <PrevButton onClick={onPrevButtonClick} disabled={prevBtnDisabled} />
//               <NextButton onClick={onNextButtonClick} disabled={nextBtnDisabled} />
//             </div>

//             <div className="embla__dots">
//               {scrollSnaps.map((_, index) => (
//                 <DotButton
//                   key={index}
//                   onClick={() => onDotButtonClick(index)}
//                   className={'embla__dot'.concat(
//                     index === dotIndex ? ' embla__dot--selected' : ''
//                   )}
//                 />
//               ))}
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// interface CardData {
//   id: number;
//   title: string;
//   src: string;
//   iframeSrc: string;
//   redirectUrl: string;
// }

// const cards: CardData[] = [
//   {
//     id: 1,
//     title: "VA",
//     src: VA,
//     iframeSrc: "https://va.hpcl.co.in/login",
//     redirectUrl: "https://va.hpcl.co.in/login",
//   },
//   {
//     id: 2,
//     title: "VTS",
//     src: VTS,
//     iframeSrc: "https://hpclvts.hpcl.co.in/",
//     redirectUrl: "https://hpclvts.hpcl.co.in/",
//   },
//   {
//     id: 3,
//     title: "CEMS",
//     src: CEMS,
//     iframeSrc: "https://cems/web/",
//     redirectUrl: "https://cems/web/",
//   },
//   {
//     id: 4,
//     title: "REFINARY",
//     src: REFINARY,
//     iframeSrc: "https://cems/web/",
//     redirectUrl: "https://cems/web/",
//   },
//   {
//     id: 5,
//     title: "EMLOCK",
//     src: EMLOCK,
//     iframeSrc: "https://algo-ceg-dev.analytics.algofusiontech.com/superset/dashboard/b2df8e09-6cd5-4ff5-a37d-6f75c21694d6",
//     redirectUrl: "https://algo-ceg-dev.analytics.algofusiontech.com/superset/dashboard/b2df8e09-6cd5-4ff5-a37d-6f75c21694d6",
//   },
//   {
//     id: 6,
//     title: "SUPPLY CHAIN",
//     src: SUPPLY_CHAIN,
//     iframeSrc: '/superset/dashboard/p/yaD4Ar6mOP2/',
//     redirectUrl: '/superset/dashboard/p/yaD4Ar6mOP2/',
//   },
//   {
//     id: 7,
//     title: "LPG PLANT",
//     src: SUPPLY_CHAIN,
//     iframeSrc: '/superset/dashboard/p/Vjb7En142Ne/',
//     redirectUrl: '/superset/dashboard/p/wgD4X6QLOPJ/',
//   },
// ];

// function Operations() {
//   const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
//   const navigate = useNavigate();
//   const OPTIONS: EmblaOptionsType = { loop: true, duration: 30 };

//   function handleOpen(index: number) {
//     setSelectedIndex(index);
//   }

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white-300 to-gray-50">
//       <Breadcrumb className="px-3 py-2">
//         <BreadcrumbList>
//           <BreadcrumbItem className="hidden md:block cursor-pointer">
//             <BreadcrumbLink onClick={() => navigate('/projects')}>
//               Home
//             </BreadcrumbLink>
//           </BreadcrumbItem>
//           <BreadcrumbSeparator className="hidden md:block" />
//           <BreadcrumbItem>
//             <BreadcrumbPage>Operation</BreadcrumbPage>
//           </BreadcrumbItem>
//         </BreadcrumbList>
//       </Breadcrumb> 

//       <main className="container mx-auto px-3 py-3">
//         <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
//           {cards.map((card, index) => (
//             <Card
//               key={card.id}
//               title={card.title}
//               src={card.src}
//               onOpen={() => handleOpen(index)}
//             />
//           ))}
//         </div>
//       </main>

//       <FullscreenFrame
//         isOpen={selectedIndex !== null}
//         title={selectedIndex !== null ? cards[selectedIndex].title : ''}
//         onClose={() => setSelectedIndex(null)}
//         slides={cards}
//         options={OPTIONS}
//         selectedIndex={selectedIndex}
//       />
//     </div>
//   );
// }

// export default Operations;
