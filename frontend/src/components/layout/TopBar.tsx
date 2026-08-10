import {
  TooltipProvider,
  Tooltip as ShadcnTooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/@/components/ui/tooltip";
import { Flex, HStack, IconButton, Spacer, Text } from "@chakra-ui/react";
import {
  IconBell,
  IconGlobe,
  IconScreenshot,
  IconSearch,
  IconSettings,
  IconUser,
  IconIkosaedr,
  IconHome2,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import assets from "../../assets";
import useAuthStore from "@/store/authStore";
import { LogOut, Ticket, Minimize2, X } from "lucide-react";
import { Tooltip } from "@mui/material";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/@/components/ui/popover";
import { Button } from "@/@/components/ui/button";
import { Avatar, AvatarFallback } from "@/@/components/ui/avatar";
import { Separator } from "@/@/components/ui/separator";
import { Mail } from "lucide-react";
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { CreateTicketDialog } from "@/pages/component/Ticketing2/components/CreateTicketDialog";
import { Ticketing2Dashboard } from "@/pages/component/Ticketing2/components/Ticketing2Dashboard";

interface ComponentNameProps {}
type MenuPermission = {
  menu_name: string;
  allowed_sub_menus?: string[];
};

interface User {
  novex_role?: string[];
  permissions?: MenuPermission[];
  allowed_roles?: MenuPermission[];
}

const TopBarComponent = (props: ComponentNameProps) => {
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const hasButtonAccess = useAuthStore((state) => state.hasButtonAccess);
  const user = useAuthStore((state) => state.user);

  // Ticket creation state
  const [createTicketDialogOpen, setCreateTicketDialogOpen] = useState(false);
  const [isTicketFormMinimized, setIsTicketFormMinimized] = useState(false);
  const [savedFormData, setSavedFormData] = useState<any>(null);
  const [isFileInputActive, setIsFileInputActive] = useState(false);

  // Tickets kanban board modal state
  const [ticketsModalOpen, setTicketsModalOpen] = useState(false);
  const [isTicketsModalMinimized, setIsTicketsModalMinimized] = useState(false);
  const [showTicketsCreate, setShowTicketsCreate] = useState(false);
  const [ticketsInitialData, setTicketsInitialData] = useState<any | null>(null);

  const logoutSession = async () => {
    try {
      await logout();
      const currentUser = useAuthStore.getState().user;
      console.log("currentUser", currentUser);
      if (!currentUser) {
        navigate("/");
      }
    } catch (err) {
      console.log(err);
    }
  };

  const fullName = user
    ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
    : "User";
  const initials = fullName
    .split(" ")
    .map((name) => name[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);

  const formattedRoles =
    user?.novex_role && Array.isArray(user.novex_role)
      ? user.novex_role.join(", ")
      : user?.novex_role || "Admin";

  const [open, setOpen] = useState<boolean>(false);
  const [loginTime, setLoginTime] = useState<string>("");

  useEffect(() => {
    const now = dayjs();
    const formatted = now.format("dddd, h:mm A");
    setLoginTime(`Last login: ${formatted}`);
  }, []);

  // Handle file input focus/blur to ensure upload dialog appears above modal
  useEffect(() => {
    const handleFileInputFocus = (e: FocusEvent) => {
      if (
        (e.target as HTMLElement)?.tagName === "INPUT" &&
        (e.target as HTMLInputElement)?.type === "file"
      ) {
        setIsFileInputActive(true);
      }
    };

    const handleFileInputBlur = (e: FocusEvent) => {
      if (
        (e.target as HTMLElement)?.tagName === "INPUT" &&
        (e.target as HTMLInputElement)?.type === "file"
      ) {
        setIsFileInputActive(false);
      }
    };

    document.addEventListener("focusin", handleFileInputFocus);
    document.addEventListener("focusout", handleFileInputBlur);

    return () => {
      document.removeEventListener("focusin", handleFileInputFocus);
      document.removeEventListener("focusout", handleFileInputBlur);
    };
  }, []);

  // Handle ticket dialog close
  // const handleTicketDialogClose = () => {
  // setCreateTicketDialogOpen(false);
  // setIsTicketFormMinimized(false);
  // };

  // Handle minimize
  const handleMinimize = () => {
    setIsTicketFormMinimized(true);
  };

  // Handle restore from minimized
  const handleRestore = () => {
    setIsTicketFormMinimized(false);
  };

  // Handle ticket dialog close - reset everything
  const handleTicketDialogClose = () => {
    setCreateTicketDialogOpen(false);
    setIsTicketFormMinimized(false);
    setSavedFormData(null);
  };

  // Handle tickets modal minimize
  const handleTicketsModalMinimize = () => {
    setIsTicketsModalMinimized(true);
  };

  // Handle tickets modal restore
  const handleTicketsModalRestore = () => {
    setIsTicketsModalMinimized(false);
  };

  // Handle tickets modal close - reset everything
  const handleTicketsModalClose = () => {
    setTicketsModalOpen(false);
    setIsTicketsModalMinimized(false);
    setShowTicketsCreate(false);
    setTicketsInitialData(null);
  };

  return (
    <>
      <Flex
        as="header"
        position="fixed"
        top={0}
        w="100%"
        h="60px"
        background="#fff"
        boxShadow="0px 1px 2px 0px #ccc"
        borderColor="gray.200"
        px={5}
        align="center"
        zIndex={1}
      >
        <Flex align="center" gap={2}>
          <img
            src={assets.images.logo}
            alt="HPCL Logo"
            style={{ height: "60px", margin: "0px 14px" }}
          />
        </Flex>
        <Flex
          position="absolute"
          left="50%"
          transform="translateX(-50%)"
          align="center"
        >
            <img
              src={assets.images.novex}
              alt="Novex Logo"
              style={{
                width: "150px",
                height: "auto",
                display: "block",
                pointerEvents: "none",
                transform: "scale(1.5)",
                transformOrigin: "center center",
              }}
            />
        </Flex>

        <Spacer />
        <HStack spacing={4} gap="10" pr={4}>
          {hasButtonAccess() && (
            <>
              <TooltipProvider>
                <button
                  onClick={() => navigate("/dnc/home/wall")}
                  className="flex items-center justify-center text-sm sm:text-xs md:text-xs lg:text-xs xl:text-base text-white font-bold py-2 px-4 cursor-pointer rounded-full shadow-lg transform transition-transform duration-300 hover:scale-110 bg-gradient-to-l from-blue-400 via-violet-600 to-blue-800"
                >
                  <div className="flex items-center justify-center gap-1">
                    <IconHome2
                      stroke={1.5}
                      className="w-2 h-2 sm:w-2 sm:h-2 md:w-4 md:h-4 lg:w-6 lg:h-6"
                    />
                    <span>NOVEX Wall</span>
                  </div>
                </button>
              </TooltipProvider>

              {/* Floating Ticket Button */}
              {/* {!location.pathname.includes('/ticket') && !location.pathname.includes('/settings/tickets') && !location.pathname.includes('/settings/add-edit-ticketing') && ( */}
              <div className="ml-2">
                <TooltipProvider>
                  <ShadcnTooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => {
                          setTicketsModalOpen(true);
                          setIsTicketsModalMinimized(false);
                        setShowTicketsCreate(false);
                        }}
                        className="flex items-center justify-center text-white font-bold p-2 cursor-pointer rounded-full shadow-lg transform transition-transform duration-300 hover:scale-110 bg-gradient-to-r from-blue-800 via-purple-600 to-pink-500"
                      >
                        <Ticket className="w-5 h-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>View Tickets</p>
                    </TooltipContent>
                  </ShadcnTooltip>
                </TooltipProvider>
              </div>

              {/* )} */}
            </>
          )}

          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full hover:bg-blue-50 transition-colors"
              >
                <Avatar className="h-8 w-8 ring-2 ring-blue-100 hover:ring-blue-300 transition-all">
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-0 shadow-xl rounded-xl max-h-[100vh] flex flex-col overflow-hidden border-none">
              <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 bottom-0 opacity-20">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                  <div className="absolute bottom-0 left-10 w-20 h-20 bg-blue-300 rounded-full blur-2xl"></div>
                </div>
                <Button
                  size="sm"
                  className="z-50 absolute top-3 right-3 h-8 w-8 p-0 rounded-full bg-white/20 hover:bg-white/30 text-white border-none shadow-md"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-4 w-4 pointer-events-none" />
                </Button>

                <div className="flex items-center gap-4 relative z-10">
                  <Avatar className="h-16 w-16 border-2 border-white shadow-lg ring-4 ring-white/30">
                    <AvatarFallback className="bg-white text-blue-700 font-bold text-xl">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-white">
                    <h3 className="font-semibold text-xl tracking-tight">
                      {fullName}
                    </h3>
                    <div className="flex items-center mt-1 text-blue-100">
                      <Mail className="h-3 w-3 mr-1" />
                      <p className="text-xs">
                        {user?.email || "No email available"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-5 overflow-y-auto flex-grow bg-gradient-to-b from-gray-50 to-white">
                <div className="mb-5">
                  <h4 className="text-xs font-bold text-blue-600 mb-3 uppercase tracking-wider">
                    Account Information
                  </h4>
                  <div className="space-y-2.5">
                    {String(user?.employee_id || "").trim() && (
                      <div className="flex flex-row items-center p-3 bg-white rounded-lg border border-gray-100 shadow-sm hover:shadow transition-shadow">
                        <span className="text-xs font-medium text-gray-500 w-24">
                          Employee ID:
                        </span>
                        <span className="font-medium text-sm text-gray-800">
                          {user?.employee_id || "Not available"}
                        </span>
                      </div>
                    )}
                    {String(user?.sap_id || "").trim() && (
                      <div className="flex flex-row items-center p-3 bg-white rounded-lg border border-gray-100 shadow-sm hover:shadow transition-shadow">
                        <span className="text-xs font-medium text-gray-500 w-24">
                          SAP ID:
                        </span>
                        <span className="font-medium text-sm text-gray-800">
                          {user?.sap_id || "Not available"}
                        </span>
                      </div>
                    )}
                    {String(user?.novex_role || "").trim() && (
                      <div className="flex flex-row items-center p-3 bg-white rounded-lg border border-gray-100 shadow-sm hover:shadow transition-shadow">
                        <span className="text-xs font-medium text-gray-500 w-24">
                          Novex Role:
                        </span>
                        <div className="font-medium text-sm text-gray-800">
                          {formattedRoles}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Location Information */}
                {(String(user?.bu || "").trim() ||
                  String(user?.region || "").trim() ||
                  String(user?.zone || "").trim() ||
                  String(user?.state || "").trim() ||
                  String(user?.sales_area || "").trim()) && (
                  <div className="mb-5">
                    <h4 className="text-xs font-bold text-blue-600 mb-3 uppercase tracking-wider">
                      Location Information
                    </h4>
                    <div className="space-y-2.5">
                      {String(user?.bu || "").trim() && (
                        <div className="flex flex-row items-center p-3 bg-white rounded-lg border border-gray-100 shadow-sm hover:shadow transition-shadow">
                          <span className="text-xs font-medium text-gray-500 w-24">
                            BU:
                          </span>
                          <span className="font-medium text-sm text-gray-800">
                            {user.bu}
                          </span>
                        </div>
                      )}
                      {String(user?.region || "").trim() && (
                        <div className="flex flex-row items-center p-3 bg-white rounded-lg border border-gray-100 shadow-sm hover:shadow transition-shadow">
                          <span className="text-xs font-medium text-gray-500 w-24">
                            Region:
                          </span>
                          <span className="font-medium text-sm text-gray-800">
                            {user.region}
                          </span>
                        </div>
                      )}
                      {(String(user?.zone || "").trim() ||
                        String(user?.state || "").trim()) && (
                        <div className="grid grid-cols-2 gap-2.5">
                          {String(user?.zone || "").trim() && (
                            <div className="flex flex-row items-center p-3 bg-white rounded-lg border border-gray-100 shadow-sm hover:shadow transition-shadow">
                              <span className="text-xs font-medium text-gray-500 w-16">
                                Zone:
                              </span>
                              <span className="font-medium text-sm text-gray-800">
                                {user.zone}
                              </span>
                            </div>
                          )}
                          {String(user?.state || "").trim() && (
                            <div className="flex flex-row items-center p-3 bg-white rounded-lg border border-gray-100 shadow-sm hover:shadow transition-shadow">
                              <span className="text-xs font-medium text-gray-500 w-16">
                                State:
                              </span>
                              <span className="font-medium text-sm text-gray-800">
                                {user.state}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      {String(user?.sales_area || "").trim() && (
                        <div className="flex flex-row items-center p-3 bg-white rounded-lg border border-gray-100 shadow-sm hover:shadow transition-shadow">
                          <span className="text-xs font-medium text-gray-500 w-24">
                            Sales Area:
                          </span>
                          <span className="font-medium text-sm text-gray-800">
                            {user.sales_area}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 p-4 flex justify-between items-center mt-auto bg-white">
                <div className="flex items-center text-gray-500">
                  <span className="text-xs">{loginTime}</span>
                </div>
                <Button
                  onClick={logoutSession}
                  variant="outline"
                  size="sm"
                  className="h-8 px-4 bg-gradient-to-r from-red-50 to-red-100 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 shadow-sm"
                >
                  <LogOut className="h-3.5 w-3.5 mr-1.5" />
                  Sign Out
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Tooltip title="Logout">
            <IconButton
              onClick={logoutSession}
              aria-label="User"
              icon={<LogOut className="h-5 w-5" color="#284a9d" />}
              variant="ghost"
            />
          </Tooltip>
        </HStack>
      </Flex>

      {/* Ticket Dialog - always mounted when opened to preserve form state */}
      {createTicketDialogOpen && (
        <>
          {/* Modal Overlay - always present but hidden when minimized */}
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              zIndex: isFileInputActive ? 1 : 1000000000,
              display: isTicketFormMinimized ? "none" : "block",
            }}
            onClick={handleTicketDialogClose}
          />

          {/* Dialog Container with Controls - right slide popup like ComplianceTab */}
          <div
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[95%] md:w-[90%] lg:w-[85%] max-w-[1600px] bg-white shadow-2xl animate-slideInRight rounded-l-2xl"
            style={{
              zIndex: isFileInputActive ? 2 : 1000000001,
              display: "flex",
              flexDirection: "column",
              visibility: isTicketFormMinimized ? "hidden" : "visible",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Controls */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                // padding: '12px 16px',
                borderBottom: "1px solid #e5e7eb",
                backgroundColor: "#f9fafb",
                position: "relative",
              }}
            >
              {/* Button container - keeps buttons side by side */}
              <div className="absolute top-3 z-[1000000002] flex items-center gap-1 left-2 md:-left-[72px] lg:-left-[72px]">
                {/* Close button */}
                <button
                  onClick={handleTicketDialogClose}
                  className="group bg-white hover:bg-gray-100 rounded-full p-1.5 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 border border-gray-200 w-8 h-8 flex items-center justify-center"
                  aria-label="Close"
                  title="Close"
                >
                  <X className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-900 group-hover:rotate-90 transition-all duration-300" />
                </button>
                {/* Minimize button */}
                <button
                  onClick={handleMinimize}
                  className="group bg-white hover:bg-gray-100 rounded-full p-1.5 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 border border-gray-200 w-8 h-8 flex items-center justify-center"
                  title="Minimize"
                >
                  <Minimize2 className="h-3 w-3 text-gray-600 group-hover:text-gray-900" />
                </button>
              </div>
            </div>

            {/* Dialog Content */}
            <div style={{ flex: 1, overflow: "auto" }}>
              <CreateTicketDialog
                open={true}
                onOpenChange={handleTicketDialogClose}
                isMinimized={isTicketFormMinimized}
                onMinimizeChange={setIsTicketFormMinimized}
              />
            </div>
          </div>
        </>
      )}

      {/* Minimized Ticket Indicator */}
      {createTicketDialogOpen && isTicketFormMinimized && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            zIndex: 1000000002,
          }}
        >
          <button
            onClick={handleRestore}
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-3 transition-all transform hover:scale-105"
            style={{
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }}
          >
            <Ticket className="w-5 h-5" />
            <div className="flex flex-col items-start">
              <span className="text-sm font-semibold">Create Ticket</span>
              <span className="text-xs opacity-90">Click to restore</span>
            </div>
          </button>
        </div>
      )}

      {/* Tickets Modal - kanban board */}
      {ticketsModalOpen && (
        <>
          {/* Modal Overlay */}
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              zIndex: isFileInputActive ? 1 : 999999998,
              display: isTicketsModalMinimized ? "none" : "block",
            }}
            onClick={handleTicketsModalClose}
          />

          {/* Dialog Container with Controls - right slide popup */}
          <div
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[98%] md:w-[95%] lg:w-[90%] max-w-[1700px] bg-white flex flex-col"
            style={{
              zIndex: isFileInputActive ? 2 : 999999999,
              visibility: isTicketsModalMinimized ? "hidden" : "visible",
              boxShadow: "-10px 0 25px -5px rgba(0, 0, 0, 0.1)",
              animation: "slideInRight 0.3s ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Controls */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                // padding: '12px 16px',
                borderBottom: "1px solid #e5e7eb",
                backgroundColor: "#f9fafb",
                position: "relative",
              }}
            >
              {/* Button container - keeps buttons side by side */}
              <div className="absolute top-3 z-[1000000000] flex items-center gap-1 left-2 md:-left-[72px] lg:-left-[72px]">
                {/* Close button */}
                <button
                  onClick={handleTicketsModalClose}
                  className="group bg-white hover:bg-gray-100 rounded-full p-1.5 shadow-lg border border-gray-200 w-8 h-8 flex items-center justify-center transition-all duration-300 hover:scale-105"
                  title="Close"
                >
                  <X className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-900 group-hover:rotate-90 transition-all duration-300" />
                </button>
                {/* Minimize button */}
                <button
                  onClick={handleTicketsModalMinimize}
                  className="group bg-white hover:bg-gray-100 rounded-full p-1.5 shadow-lg border border-gray-200 w-8 h-8 flex items-center justify-center transition-all duration-300 hover:scale-105"
                  title="Minimize"
                >
                  <Minimize2 className="h-3 w-3 text-gray-600 group-hover:text-gray-900" />
                </button>
              </div>
            </div>

            {/* Dialog Content */}
            <div style={{ flex: 1, overflow: "auto" }}>
              {showTicketsCreate ? (
                <CreateTicketDialog
                  open={true}
                  onOpenChange={(open) => {
                    if (!open) {
                      setShowTicketsCreate(false);
                      setTicketsInitialData(null);
                    }
                  }}
                  ticketSection="tickets"
                 initialData={ticketsInitialData}
                />
              ) : (
                <Ticketing2Dashboard
                  onCreateTicketClick={() => {
                    setTicketsInitialData(null);
                    setShowTicketsCreate(true);
                  }}
                  onTicketClick={(ticket) => {
                    setTicketsInitialData(ticket);
                    setShowTicketsCreate(true);
                  }}
                />
              )}
            </div>
          </div>
        </>
      )}

      {/* Minimized Tickets Modal Indicator */}
      {ticketsModalOpen && isTicketsModalMinimized && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            zIndex: 9999,
          }}
        >
          <button
            onClick={handleTicketsModalRestore}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-3 transition-all transform hover:scale-105"
            style={{
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }}
          >
            <Ticket className="w-5 h-5" />
            <div className="flex flex-col items-start">
              <span className="text-sm font-semibold">View Tickets</span>
              <span className="text-xs opacity-90">Click to restore</span>
            </div>
          </button>
        </div>
      )}

      <style>{`
 @keyframes float {
 0%, 100% {
 transform: translateY(0px);
 }
 50% {
 transform: translateY(-8px);
 }
 }
 @keyframes pulse-ring {
 0% {
 box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
 }
 70% {
 box-shadow: 0 0 0 10px rgba(34, 197, 94, 0);
 }
 100% {
 box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
 }
 }
 @keyframes pulse {
 0%, 100% {
 opacity: 1;
 }
 50% {
 opacity: .8;
 }
 }
 @keyframes slideInRight {
 from {
 transform: translateX(100%);
 }
 to {
 transform: translateX(0);
 }
 }
 `}</style>
    </>
  );
};

export default TopBarComponent;
