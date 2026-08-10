import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../@/components/ui/card';
import SpotFire from '../../assets/hpcl/spotfire.png';
import VA from '../../assets/hpcl/VA.png';
import VTS from '../../assets/hpcl/VTS.png';
import CEMS from '../../assets/hpcl/CEMS.jpeg';
import REFINARY from '../../assets/hpcl/REFINARY.jpeg';
import SUPPLY_CHAIN from '../../assets/hpcl/SUPPLY_CHAIN.png';
import EMLOCK from '../../assets/hpcl/EMLOCK.png';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../@/components/ui/dialog';

const HomePage = () => {

    const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [url, setUrl] = useState('');
  
  const openDashboard = (url: string) => {
    // window.open(url, "_blank");
    setIsDialogOpen(true);
    setUrl(url);
  };

  const cards = [
    {
      id: 2,
      title: "VA",
      src: VA,
      iframeSrc: "https://va.hpcl.co.in/login",
      redirectUrl: "https://va.hpcl.co.in/login",
    },
    {
      id: 1,
      title: "VTS",
      src: VTS,
      iframeSrc: "https://hpclvts.hpcl.co.in/",
      redirectUrl: "https://hpclvts.hpcl.co.in/",
    },
    {
      id: 3,
      title: "CEMS",
      src: CEMS,
      iframeSrc: "https://cems/web/",
      redirectUrl: "https://cems/web/",
    },
    {
      id: 4,
      title: "REFINARY",
      src: REFINARY,
      iframeSrc: "https://cems/web/",
      redirectUrl: "https://cems/web/",
    },
    {
      id: 5,
      title: "EMLOCK",
      src: EMLOCK,
      iframeSrc: "https://algo-ceg-dev.analytics.algofusiontech.com/superset/dashboard/b2df8e09-6cd5-4ff5-a37d-6f75c21694d6/?native_filters_key=y_RAgxzxpVVw7PIZNxhSEn1C1hZSVHkKcvegvmL20Wr3aQMVjdTSzpqSQsjJeCKL",
      redirectUrl: "https://algo-ceg-dev.analytics.algofusiontech.com/superset/dashboard/b2df8e09-6cd5-4ff5-a37d-6f75c21694d6/?native_filters_key=y_RAgxzxpVVw7PIZNxhSEn1C1hZSVHkKcvegvmL20Wr3aQMVjdTSzpqSQsjJeCKL",
    },
    {
      id: 6,
      title: "SUPPLY CHAIN",
      src: SUPPLY_CHAIN,
      iframeSrc: "https://algo-ceg-dev.analytics.algofusiontech.com/superset/dashboard/b2df8e09-6cd5-4ff5-a37d-6f75c21694d6/?native_filters_key=y_RAgxzxpVVw7PIZNxhSEn1C1hZSVHkKcvegvmL20Wr3aQMVjdTSzpqSQsjJeCKL",
      redirectUrl: "https://algo-ceg-dev.analytics.algofusiontech.com/superset/dashboard/b2df8e09-6cd5-4ff5-a37d-6f75c21694d6/?native_filters_key=y_RAgxzxpVVw7PIZNxhSEn1C1hZSVHkKcvegvmL20Wr3aQMVjdTSzpqSQsjJeCKL",
    },
  ];

  return (
    <>
    <div className="grid grid-cols-2 gap-6 p-6">
      {cards.map((card) => (
        <Card
          key={card.id}
          className="relative group w-full overflow-hidden border border-gray-200 shadow-lg rounded-lg transition-transform duration-300 hover:scale-105"
        >
          <CardHeader className="px-4 py-2 bg-gray-200 text-gray-800">
            <CardTitle className="text-md font-semibold">{card.title}</CardTitle>
          </CardHeader>
          <CardContent className="relative p-4" onClick={() => openDashboard(card.redirectUrl)}>
            {
              card.src ? (
                <img
                  src={card.src}
                  alt="Spotfire"
                  className="object-cover w-full h-full"
                />
              ) : ( 
                <iframe
                src={card.iframeSrc}
                width="100%"
                height="400px"
                className="rounded-lg shadow-md"
                title={card.title}
                ></iframe>
              )
            }
            
            {/* Blur and "Show More" on hover */}
            <div className="absolute inset-0 bg-black bg-opacity-40 backdrop-blur-xs flex flex-col justify-center items-center opacity-0 group-hover:opacity-50 transition-opacity duration-300">
              {/* <button
                onClick={() => openDashboard(card.redirectUrl)}
                className="px-4 py-2 bg-blue-400 text-white rounded-lg hover:bg-blue-500"
              >
                Open
              </button> */}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>

     
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogContent className="max-w-[95vw] h-[83%]">
        {/* <DialogHeader className='p-0'></DialogHeader> */}
        <div className="py-4">
          <iframe 
            src={url}
            width="100%"
            className="h-[80%]"
          ></iframe>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default HomePage;

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