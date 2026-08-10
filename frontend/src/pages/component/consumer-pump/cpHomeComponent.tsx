import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/@/components/ui/breadcrumb';
import { useNavigate } from 'react-router-dom';

interface ComponentNameProps {}

const CpHomeComponent = (props: ComponentNameProps) => {

  const navigate = useNavigate();

  return (
    <>
      <div className="w-full h-screen border border-gray-300 rounded-lg shadow-lg">
        <Breadcrumb className="px-3 py-2">
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block cursor-pointer">
              <BreadcrumbLink onClick={() => navigate('/industryperformance')}>
                Home
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>CP Home</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb> 
        <iframe 
          src="/analytics-dnc#/report-viewer?dir=ConsumerPump&file=Consumer_Pump_Sales_Volume.efwdd&mode=open&j_username=hiadmin&j_password=hiadmin"
          className="w-full h-full"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          loading="lazy"
          allowFullScreen>
        </iframe>
      </div>
    </>
  );
};

export default CpHomeComponent;
