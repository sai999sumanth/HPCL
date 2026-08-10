import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/@/components/ui/breadcrumb';
import { useNavigate } from 'react-router-dom';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/@/components/ui/tabs";

interface ComponentNameProps {}

const LPGPlantComponent = (props: ComponentNameProps) => {

  const navigate = useNavigate();

  return (
    <>
      <div className="w-full h-screen border border-gray-300 rounded-lg shadow-lg">
        <Breadcrumb className="px-3 py-2">
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block cursor-pointer">
              <BreadcrumbLink onClick={() => navigate('/projects')}>
                Home
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>LPG Plant</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb> 

        <iframe
          src="/analytics-dnc/#/report-viewer?dir=LPG_OPERATION&file=LPG_OPERATIONS_DASHBOARD.efwdd&mode=open&j_username=hiadmin&j_password=hiadmin"
          className="w-full h-full"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          loading="lazy"
          allowFullScreen
        ></iframe>

        {/* <Tabs defaultValue="LPG perform" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="LPG perform">LPG Performance</TabsTrigger>
            <TabsTrigger value="LPG details">Perfomance Details</TabsTrigger>
          </TabsList>
          <TabsContent className='w-full h-screen mt-0' value="LPG perform">
            <iframe
              src="/superset/dashboard/14/?native_filters_key=0TXLpvAA6lqEBIp-bjsc_oqM_qu4kMdn5GTeBfe6hOas1MCfT8rVNwOgWXkdAEUo"
              className="w-full h-full"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              loading="lazy"
              allowFullScreen
            ></iframe>
          </TabsContent>
          <TabsContent className='w-full h-screen mt-0' value="LPG details">
            <iframe
              src="/superset/dashboard/14/?native_filters_key=0TXLpvAA6lqEBIp-bjsc_oqM_qu4kMdn5GTeBfe6hOas1MCfT8rVNwOgWXkdAEUo"
              className="w-full h-full"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              loading="lazy"
              allowFullScreen
            ></iframe>
          </TabsContent>
        </Tabs> */}
      </div>
    </>
  );
};

export default LPGPlantComponent;
