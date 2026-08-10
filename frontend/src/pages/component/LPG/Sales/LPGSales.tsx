import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/@/components/ui/breadcrumb';
import { useNavigate } from 'react-router-dom';
interface ComponentNameProps {}

const LPGSalesComponent = (props: ComponentNameProps) => {

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
              <BreadcrumbPage>LPG Sales</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb> 
        <iframe
          src="/analytics-dnc/#/report-viewer?dir=CDCMS&file=CDCMS_DASHBOARD_UPDATED.efwdd&mode=open&j_username=hiadmin&j_password=hiadmin"
          className="w-full h-full"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          loading="lazy"
          allowFullScreen
        ></iframe>
        {/* <iframe
          src="/superset/dashboard/p/Vjb7En142Ne/"
          className="w-full h-full"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          loading="lazy"
          allowFullScreen
        ></iframe> */}



        {/* <Tabs defaultValue="analysis" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="anaysis">Customer Analysis</TabsTrigger>
            <TabsTrigger value="sales">Sales</TabsTrigger>
          </TabsList>
          <TabsContent className='w-full h-screen mt-0' value="analysis">
            <iframe
              src="/superset/dashboard/14/?native_filters_key=0TXLpvAA6lqEBIp-bjsc_oqM_qu4kMdn5GTeBfe6hOas1MCfT8rVNwOgWXkdAEUo"
              className="w-full h-full"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              loading="lazy"
              allowFullScreen
            ></iframe>
          </TabsContent>
          <TabsContent className='w-full h-screen mt-0' value="sales">
            <iframe
              src="/analytics-dnc/#/report-viewer?dir=CDCMS&file=CDCMS_DASHBOARD_01.efwdd&mode=open&j_username=hiadmin&j_password=hiadmin"
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

export default LPGSalesComponent;
