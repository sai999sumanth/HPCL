import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/@/components/ui/breadcrumb';
import { useNavigate } from 'react-router-dom';

interface ComponentNameProps {}

const CDCEMSComponent = (props: ComponentNameProps) => {

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
              <BreadcrumbPage>CDCMS</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb> 
        <iframe 
          src="/analytics-dnc/#/report-viewer?dir=CDCMS&file=CDCMS_DASHBOARD_UPDATED.efwdd&mode=open&j_username=hiadmin&j_password=hiadmin"
          className="w-full h-full"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          loading="lazy"
          allowFullScreen>
        </iframe>
      </div>
    </>
  );
};

export default CDCEMSComponent;
