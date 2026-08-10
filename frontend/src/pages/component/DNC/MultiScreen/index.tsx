import axios from 'axios';
import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { ScreenLayout } from './components/ScreenLayout';
import type { Layout, ScreenItem, GridScreen } from '@/types/screen';
import React from 'react';
import ConfettiExplosion, { ConfettiProps } from 'react-confetti-explosion';
import { GalleryNavButton } from '../GalleryView/gallery/GalleryNavButton';
import { GalleryViewer } from '../GalleryView/gallery/GalleryViewer';
import { GalleryThumbnailStrip } from '../GalleryView/gallery/GalleryThumbnailStrip';
import VA from '@/assets/hpcl/VA.png';
import VTS from '@/assets/hpcl/VTS.png';
import CEMS from '@/assets/hpcl/CEMS.jpeg';
import REFINARY from '@/assets/hpcl/REFINARY.jpeg';
import SUPPLY_CHAIN from '@/assets/hpcl/SUPPLY_CHAIN.png';
import EMLOCK from '@/assets/hpcl/EMLOCK.png';
import GradualSpacing from '@/components/ui/gradual-spacing';
import OILGAS from '@/assets/hpcl/oil-and-gas-drilling-1.jpeg';
import TopBarComponent from '@/components/layout/TopBar';

interface CardData {
  id: number;
  title: string;
  isRoute: boolean;
  routingURL: string;
  src: string;
  iframeSrc: string;
  redirectUrl: string;
}

const initialScreens: ScreenItem[] = [
  {
    id: '1',
    title: 'Analytics Dashboard',
    content: 'Key metrics and performance indicators for monitoring system performance and user engagement.',
    createdBy: 'John Doe',
    createdAt: '2024-03-20T10:00:00Z',
    updatedAt: '2024-03-21T15:30:00Z',
    x: 0,
    y: 0,
    w: 6,
    h: 4,
  },
  {
    id: '2',
    title: 'User Activity',
    content: 'Real-time user engagement data showing active sessions, interactions, and user behavior patterns.',
    createdBy: 'Jane Smith',
    createdAt: '2024-03-19T14:20:00Z',
    updatedAt: '2024-03-21T09:15:00Z',
    x: 6,
    y: 0,
    w: 6,
    h: 4,
  },
  {
    id: '3',
    title: 'System Status',
    content: 'Current system health metrics, alerts, and performance indicators for infrastructure monitoring.',
    createdBy: 'Mike Johnson',
    createdAt: '2024-03-18T11:45:00Z',
    updatedAt: '2024-03-21T16:20:00Z',
    x: 0,
    y: 4,
    w: 4,
    h: 3,
  },
  {
    id: '4',
    title: 'Recent Updates',
    content: 'Latest system updates, deployments, and changes tracked across the platform.',
    createdBy: 'Sarah Wilson',
    createdAt: '2024-03-17T16:30:00Z',
    updatedAt: '2024-03-21T14:10:00Z',
    x: 4,
    y: 4,
    w: 8,
    h: 3,
  },
];
const largeProps: ConfettiProps = {
  force: 1,
  duration: 5000,
  particleCount: 500,
  width: 2500,
  colors: ['#041E43', '#1471BF', '#5BB4DC', '#FC027B', '#66D805'],
};

function MultiScreen() {
  const [isExploding, setIsExploding] = React.useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  const handlePrevious = () => {
    setActiveIndex((current) => (current === 0 ? cards.length - 1 : current - 1));
  };

  const handleNext = () => {
    setActiveIndex((current) => (current === cards.length - 1 ? 0 : current + 1));
  };

  // const [isCollapsed, setIsCollapsed] = useState(false);
  // const [availableScreens] = useState<ScreenItem[]>(initialScreens);
  // const [gridScreens, setGridScreens] = useState<GridScreen[]>([]);

  // useEffect(() => {
  //   getAllScreens();
  // }, [])

  // const getAllScreens = React.useCallback(async () => {
  //   axios.get('/api/screens?skip=0&limit=0').then((response) => {
  //     console.log(response.data);

  //   }).catch((error) => {
  //     console.log(error)
  //   })
  // }, [])


  // const handleLayoutChange = (layout: Layout[]) => {
  //   setGridScreens((prev) =>
  //     prev.map((screen) => {
  //       const newLayout = layout.find((l) => l.i === screen.id);
  //       if (!newLayout) return screen;
  //       return {
  //         ...screen,
  //         x: newLayout.x,
  //         y: newLayout.y,
  //         w: newLayout.w,
  //         h: newLayout.h,
  //       };
  //     })
  //   );
  // };

  // const handleAddToGrid = (screen: ScreenItem) => {
  //   if (!gridScreens.some((s) => s.id === screen.id)) {
  //     setGridScreens((prev) => [...prev, { ...screen, isVisible: true }]);
  //   }
  // };

  // const handleDeleteScreen = (id: string) => {
  //   setGridScreens((prev) => prev.filter((screen) => screen.id !== id));
  // };
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
      title: "REFINARY",
      src: REFINARY,
      isRoute: true,
      routingURL: '',
      iframeSrc: "https://cems/web/",
      redirectUrl: "https://cems/web/",
    },
    {
      id: 5,
      title: "EMLOCK",
      src: EMLOCK,
      isRoute: true,
      routingURL: '',
      iframeSrc: "https://algo-ceg-dev.analytics.algofusiontech.com/superset/dashboard/b2df8e09-6cd5-4ff5-a37d-6f75c21694d6",
      redirectUrl: "https://algo-ceg-dev.analytics.algofusiontech.com/superset/dashboard/b2df8e09-6cd5-4ff5-a37d-6f75c21694d6",
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
      routingURL: '/LPG/Plant/dashboard',
      iframeSrc: '/superset/dashboard/p/wgD4X6QLOPJ/',
      redirectUrl: '/superset/dashboard/p/wgD4X6QLOPJ/',
    },
    {
      id: 8,
      title: "LPG SALES",
      src: SUPPLY_CHAIN,
      isRoute: true,
      routingURL: '/LPG/Sales/dashboard',
      iframeSrc: '/superset/dashboard/p/Vjb7En142Ne/',
      redirectUrl: '/superset/dashboard/p/Vjb7En142Ne/',
    },
    {
      id: 9,
      title: "CDCMS",
      src: SUPPLY_CHAIN,
      isRoute: true,
      routingURL: '/LPG/CDCMS',
      iframeSrc: '/analytics-dnc/#/report-viewer?dir=CDCMS&file=CDCMS_DASHBOARD_01.efwdd&mode=open&j_username=hiadmin&j_password=hiadmin',
      redirectUrl: '/analytics-dnc/#/report-viewer?dir=CDCMS&file=CDCMS_DASHBOARD_01.efwdd&mode=open&j_username=hiadmin&j_password=hiadmin',
    },
    {
      id: 10,
      title: "LPG",
      src: SUPPLY_CHAIN,
      isRoute: false,
      routingURL: '',
      iframeSrc: '/analytics-dnc/#/report-viewer?dir=LPG&file=LPG_Dashboard_02.efwdd&mode=open&j_username=hiadmin&password=hiadmin',
      redirectUrl: '/analytics-dnc/#/report-viewer?dir=LPG&file=LPG_Dashboard_02.efwdd&mode=open&j_username=hiadmin&password=hiadmin',
    },
    {
      id: 11,
      title: "LPG 1",
      src: SUPPLY_CHAIN,
      isRoute: true,
      routingURL: '',
      iframeSrc: '/analytics-dnc/#/report-viewer?dir=LPG&file=LPG_Dashboard_1.efwdd&mode=open&j_username=hiadmin&password=hiadmin',
      redirectUrl: '/analytics-dnc/#/report-viewer?dir=LPG&file=LPG_Dashboard_1.efwdd&mode=open&j_username=hiadmin&password=hiadmin',
    },
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

  const activeCard = cards[activeIndex];
  useEffect(() => {
    // setTimeout(() => {  
    //   setIsExploding(false);
    // }, 3000);
  }, [])

  return (
    <React.Fragment>
      <TopBarComponent />
      {isExploding && 
        <div className="h-screen flex flex-col justify-center content-center" style={{backgroundImage: `url(${OILGAS})`, backgroundSize: 'cover'}}>
          <div className="flex w-full justify-center">
            <ConfettiExplosion {...largeProps} />
          </div>

          <div className="h-[525px] w-[565px] pl-7">
            <div className="h-full w-full" style={{ animation: 'bubble 5s linear infinite', backgroundImage: 'linear-gradient(180deg, #DD9044 0%, #DD4454 100%)', borderRadius: '57.8297% 46.2938% 39.9382% 62.7162% / 51.4741% 54.4741% 48.4641% 39.7112%'}}>
              <div className="flex flex-col justify-center content-center w-full h-full"> 
                <GradualSpacing
                  className="font-display text-center text-4xl font-light tracking-widest-[0rem] md:text-7xl md:leading-[5rem] animate-gradient text-white"
                  text="Novex"
                  duration={1.5}
                />

                <GradualSpacing
                  className="font-display text-center text-4xl font-light tracking-tighter text-white dark:text-white md:text-4xl md:leading-[3rem]"
                  text="The digital nerve"
                  duration={1.5}
                />

                <GradualSpacing
                  className="font-display text-center text-4xl font-light tracking-tighter text-white dark:text-white md:text-4xl md:leading-[3rem]"
                  text="centre of HPCL"
                  duration={1.5}
                />
              </div>
            </div>
          </div>
        </div>
      }
      {!isExploding && 
        <div className="h-screen flex flex-col bg-background overflow-hidden">
          <div className="flex-1 relative">
            <GalleryViewer card={activeCard} />
            <GalleryNavButton direction="left" onClick={handlePrevious} />
            <GalleryNavButton direction="right" onClick={handleNext} />
          </div>
        </div>
      }

      <div className="mt-4">
        <GalleryThumbnailStrip
          cards={cards}
          activeIndex={activeIndex}
          onSelect={setActiveIndex}
        />
      </div>

      {/* <div className="h-screen flex flex-col bg-background overflow-hidden">
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
      </div> */}
      
      {/* <div className="flex h-screen overflow-hidden bg-background">
        <main className="flex-1 overflow-auto p-6">
          <ScreenLayout
            screens={gridScreens}
            onLayoutChange={handleLayoutChange}
            onDeleteScreen={handleDeleteScreen}
          />
        </main>
        <Sidebar
          isCollapsed={isCollapsed}
          screens={availableScreens}
          onToggle={() => setIsCollapsed(!isCollapsed)}
          onAddToGrid={handleAddToGrid}
        />
      </div> */}
    </React.Fragment>
  );
}

export default MultiScreen;