import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/@/components/ui/breadcrumb";
import { useNavigate } from "react-router-dom";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/@/components/ui/tabs";

interface ComponentNameProps {}

const ComponentName = (props: ComponentNameProps) => {
  const navigate = useNavigate();

  return (
    <>
      <div className="w-full h-screen border border-gray-300 rounded-lg shadow-lg">
        {/* <Breadcrumb className="px-3 py-2">
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block cursor-pointer">
              <BreadcrumbLink onClick={() => navigate("/projects")}>
                Home
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>Supply Chain Dashboard</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb> */}

        {/* <iframe
          src="/superset/dashboard/14/?native_filters_key=0TXLpvAA6lqEBIp-bjsc_oqM_qu4kMdn5GTeBfe6hOas1MCfT8rVNwOgWXkdAEUo"
          className="w-full h-full"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          loading="lazy"
          allowFullScreen
        ></iframe> */}

        <Tabs defaultValue="IA" className="w-full h-screen">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="IA">Indent Analysis</TabsTrigger>
            <TabsTrigger value="DA">Dryout Analysis</TabsTrigger>
          </TabsList>
          <TabsContent className="w-full h-screen mt-0" value="IA">
            <iframe
              src="/analytics-dnc/#/report-viewer?dir=Indent_DryOut_N&file=I_dashboard.efwdd&mode=open&j_username=hiadmin&j_password=hiadmin"
              className="w-full h-full"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              loading="lazy"
              allowFullScreen
            ></iframe>
          </TabsContent>
          <TabsContent className="w-full h-screen mt-0" value="DA">
            <iframe
              src="/superset/dashboard/14/?native_filters_key=0TXLpvAA6lqEBIp-bjsc_oqM_qu4kMdn5GTeBfe6hOas1MCfT8rVNwOgWXkdAEUo"
              className="w-full h-full"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              loading="lazy"
              allowFullScreen
            ></iframe>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default ComponentName;
