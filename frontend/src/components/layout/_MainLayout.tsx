import { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Box, Flex, IconButton, Text, Stack, Avatar, Button,HStack, Spacer } from "@chakra-ui/react";
import { Sidebar, Menu, MenuItem, SubMenu } from "react-pro-sidebar";
import {
  IconHome,
  IconGasStation,
  IconSmartHome,
  IconLayoutDashboard,
  IconDeviceAnalytics,
  IconAsset,
  IconBrandDrops,
  IconCylinder,
  IconCurrentLocation,
  IconBuildingFactory2,
  IconTrain,
  IconAdjustmentsHorizontal,
  IconHierarchy2,
  IconPlugConnectedX,
  IconFileDatabase,
  IconContract,
  IconSettings,
  IconBell,
  IconAlertSquareRounded,
  IconUserSquareRounded,
  IconUserCog,
  IconHistory,
  IconChartLine,
  IconAdjustments,
  IconChecklist,
  IconLogs,
  IconUser,
  IconLogout,
  IconLayoutSidebarRightExpand,
  IconLayoutSidebarLeftExpand,
  IconBrandCodesandbox,
  IconTheater,
  IconMap2,
  IconUsers,
  IconAssembly,
  IconSearch,
  IconVersions,
  IconTir,
  IconHeartRateMonitor,
  IconCirclesRelation,
  IconScreenshot,
  IconDeviceDesktop,
  IconScreenShare,
  IconShield
} from "@tabler/icons-react";
import assets from "../../assets";
import colorConfigs from "../../configs/colorConfigs";
import sizeConfigs from "../../configs/sizeConfigs";
import { borderRadius, height } from "@mui/system";
import { TooltipProvider } from "@/@/components/ui/tooltip";
import TopBarComponent from "./TopBar";
import { toggleSidebar } from '@/redux/features/sidebarSlice';
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { Tooltip, Zoom } from "@mui/material";

const MainLayout = () => {

  const dispatch = useDispatch();
  const collapsed = useSelector((state: RootState) => state.sidebar.collapsed);

  // const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // const toggleSidebar = () => {
  //   setCollapsed(!collapsed);
  // };

  const handleToggleSidebar = () => {
    dispatch(toggleSidebar());
  };

  // Custom styles for menu items  #a1cdfb
  const menuItemStyles = {  
    root: { 
      fontSize: '0.700rem',
      marginTop: '3px',
      marginBottom: '3px', //Add gap between menu items
      '& .ps-menu-button': {
        height:'39px !important',
        borderRadius:'40px',
        '&:hover': {
          background: 'linear-gradient(90deg, #4AA1FF 0%, #4AA1FF 10%, #4AA1FF 50%, #4AA1FF 80%, #0284C7 100%)',
          color: 'white !important',
          '& svg': {
            color: 'white !important'
          }
        },
      },
      '&.ps-active': { 
        // background: 'linear-gradient(90deg, #0284C7 0%, #0EA5E9 20%, #38BDF8 50%, #0EA5E9 80%, #0284C7 100%)',
        background: 'linear-gradient(90deg, #4AA1FF 0%, #4AA1FF 10%, #4AA1FF 50%, #4AA1FF 80%, #0284C7 100%)',
        borderRadius:'40px',
        color: 'white',
        '& svg': {
          color: 'white'
        }
      }
    },

    icon: {
      // color: '#1EBBDA',
      color:'#4AA1FF',
      marginRight: '20px' 
    },

    subMenuContent: { 
      backgroundColor: 'white',
      '& .ps-menu-button': {
        borderRadius:'40px',
        height:'39px !important',
      }
    },

    SubMenuExpandIcon:{
      marginRight:'8px'
    },

    button: {
      '&:hover': {
          // background: 'linear-gradient(90deg, #4AA1FF 0%, #A1CDFB 20%, #4AA1FF 50%, #4AA1FF 80%, #0284C7 100%)',
          background: 'linear-gradient(90deg, #4AA1FF 0%, #4AA1FF 10%, #4AA1FF 50%, #4AA1FF 80%, #0284C7 100%)',
        color: 'white',
        '& svg': {
          color: 'white'
        }
      }
    }
  };

  // Function to check if menu item is active
  const isActive = (path) => {
    return location.pathname === path;
  };


  return (
    <Box>
      {/* Top Bar */}
      <TopBarComponent  />

      {/* Main Content with Sidebar */}
      <Flex pt="62px" h="100vh">
        <Box
          as="nav"
          w={
            collapsed
              ? sizeConfigs.sidebar.mobileWidth
              : sizeConfigs.sidebar.width
          }
          flexShrink={0}
          transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
          bg={colorConfigs.sidebar.bg}
        >
          <Sidebar
            collapsed={collapsed}
            width={sizeConfigs.sidebar.width}
            rootStyles={{
              "& .ps-sidebar-container": {
                backgroundColor: "white",
              },
            }}
          >
            {/* Main Menu */}
            <Menu
              menuItemStyles={menuItemStyles}
              className="h-[85vh] overflow-scroll"
            >
              {/* Projects/Home */}
              <Tooltip
                title="Home"
                color="red"
                placement="right"
                slots={{
                  transition: Zoom,
                }}
                disableHoverListener={!collapsed}
                arrow
              >
                <MenuItem
                  icon={<IconHome className="h-5 w-6" stroke={1.5} />}
                  component={<Link to="/industryperformance" />}
                  className={isActive("/industryperformance") ? "ps-active" : ""}
                >
                  {!collapsed && "Home"}
                </MenuItem>
              </Tooltip>

              {/* DNC*/}
              <Tooltip
                title="CEMS"
                placement="right"
                disableHoverListener={!collapsed}
                arrow
              >
                <MenuItem
                  icon={<IconVersions className="h-5 w-6" stroke={1.5} />}
                  component={<Link to="/DNC" />}
                  className={isActive("/DNC") ? "ps-active" : ""}
                >
                  {!collapsed && "CEMS"}
                </MenuItem>
              </Tooltip>

              {/* <Tooltip
                title="Monitoring"
                placement="right"
                disableHoverListener={!collapsed}
                arrow
              >
                <MenuItem
                  icon={
                    <IconHeartRateMonitor className="h-5 w-6" stroke={1.5} />
                  }
                  component={<Link to="/monitoring" />}
                  className={isActive("/monitoring") ? "ps-active" : ""}
                >
                  {!collapsed && "Monitoring"}
                </MenuItem>
              </Tooltip> */}

              {/* Retail Outlet */}
              <Tooltip
                title="Retail Outlet"
                placement="right"
                disableHoverListener={!collapsed}
                arrow
              >
                <SubMenu
                  label={!collapsed ? "Retail Outlet" : ""}
                  icon={<IconGasStation className="h-5 w-6" stroke={1.5} />}
                >
                  <MenuItem
                    icon={<IconSmartHome className="h-5 w-6" stroke={1.5} />}
                    component={<Link to="/retailOutlet/RO-Home" />}
                    className={
                      isActive("/retailOutlet/RO-Home") ? "ps-active" : ""
                    }
                  >
                    RO Home
                  </MenuItem>
                  <MenuItem
                    icon={<IconSmartHome className="h-5 w-6" stroke={1.5} />}
                    component={<Link to="/retailOutlet/SupplyChain" />}
                    className={
                      isActive("/retailOutlet/SupplyChain") ? "ps-active" : ""
                    }
                  >
                    Supply Chain
                  </MenuItem>
                  <MenuItem
                    icon={
                      <IconLayoutDashboard className="h-5 w-6" stroke={1.5} />
                    }
                    component={<Link to="/retailOutlet/dashboard" />}
                    className={
                      isActive("/retailOutlet/dashboard") ? "ps-active" : ""
                    }
                  >
                    Dashboard
                  </MenuItem>
                  <MenuItem
                    icon={
                      <IconDeviceAnalytics className="h-5 w-6" stroke={1.5} />
                    }
                    component={<Link to="/retailOutlet/videoAnalytics" />}
                    className={
                      isActive("/retailOutlet/videoAnalytics")
                        ? "ps-active"
                        : ""
                    }
                  >
                    Video Analytics
                  </MenuItem>
                  <MenuItem
                    icon={<IconAsset className="h-5 w-6" stroke={1.5} />}
                    component={<Link to="/retailOutlet/assetMaster" />}
                    className={
                      isActive("/retailOutlet/assetMaster") ? "ps-active" : ""
                    }
                  >
                    Asset Master
                  </MenuItem>
                </SubMenu>
              </Tooltip>

              <Tooltip
                title="Supply Chain"
                placement="right"
                disableHoverListener={!collapsed}
                arrow
              >
                <SubMenu
                  label={!collapsed ? "Supply Chain" : ""}
                  icon={
                    <IconCirclesRelation className="h-5 w-6" stroke={1.5} />
                  }
                >
                  <MenuItem
                    icon={<IconSmartHome className="h-5 w-6" stroke={1.5} />}
                    component={<Link to="/supplychain/home" />}
                    className={isActive("/supplychain/home") ? "ps-active" : ""}
                  >
                    Supply Chain Home
                  </MenuItem>
                  <MenuItem
                    icon={
                      <IconLayoutDashboard className="h-5 w-6" stroke={1.5} />
                    }
                    component={<Link to="/supplychain/dashboard" />}
                    className={
                      isActive("/supplychain/dashboard") ? "ps-active" : ""
                    }
                  >
                    Dashboard
                  </MenuItem>
                  {/* <MenuItem
                    icon={
                      <IconLayoutDashboard className="h-5 w-6" stroke={1.5} />
                    }
                    component={<Link to="/supplychain/dryout" />}
                    className={
                      isActive("/supplychain/dryout") ? "ps-active" : ""
                    }
                  >
                    DryOut
                  </MenuItem> */}
                  {/* <MenuItem
                    icon={
                      <IconDeviceAnalytics className="h-5 w-6" stroke={1.5} />
                    }
                    component={<Link to="/supplychain/videoAnalytics" />}
                    className={
                      isActive("/supplychain/videoAnalytics") ? "ps-active" : ""
                    }
                  >
                    Video Analytics
                  </MenuItem>
                  <MenuItem
                    icon={<IconAsset className="h-5 w-6" stroke={1.5} />}
                    component={<Link to="/supplychain/assetMaster" />}
                    className={
                      isActive("/supplychain/assetMaster") ? "ps-active" : ""
                    }
                  >
                    Asset Master
                  </MenuItem> */}
                </SubMenu>
              </Tooltip>

              {/* Retail Terminal */}

              <Tooltip
                title="Sod Terminal"
                placement="right"
                disableHoverListener={!collapsed}
                arrow
              >
                <SubMenu
                  label={!collapsed ? "SOD Terminal" : ""}
                  icon={<IconBrandDrops className="h-5 w-6" stroke={1.5} />}
                >
                  <MenuItem
                    icon={<IconSmartHome className="h-5 w-6" stroke={1.5} />}
                    component={<Link to="/sodTerminal/terminalHome" />}
                    className={
                      isActive("/retailTerminal/terminalHome")
                        ? "ps-active"
                        : ""
                    }
                  >
                    Terminal Home
                  </MenuItem>
                  <MenuItem
                    icon={
                      <IconLayoutDashboard className="h-5 w-6" stroke={1.5} />
                    }
                    component={<Link to="/sodTerminal/supply-chain" />}
                    className={
                      isActive("/sodTerminal/supply-chain") ? "ps-active" : ""
                    }
                  >
                    Supply Chain
                  </MenuItem>
                  <MenuItem
                    icon={
                      <IconLayoutDashboard className="h-5 w-6" stroke={1.5} />
                    }
                    component={<Link to="/sodTerminal/dashboard" />}
                    className={
                      isActive("/sodTerminal/dashboard") ? "ps-active" : ""
                    }
                  >
                    Dashboard
                  </MenuItem>
                  <MenuItem
                    icon={
                      <IconDeviceAnalytics className="h-5 w-6" stroke={1.5} />
                    }
                    component={<Link to="/sodTerminal/videoAnalytics" />}
                    className={
                      isActive("sodTerminal/videoAnalytics") ? "ps-active" : ""
                    }
                  >
                    Video Analytics
                  </MenuItem>
                  <MenuItem
                    icon={
                      <IconShield className="h-5 w-6" stroke={1.5} />
                    }
                    component={<Link to="/sodTerminal/tasGovernance" />}
                    className={
                      isActive("/sodTerminal/tasGovernance") ? "ps-active" : ""
                    }
                  >
                    TAS
                  </MenuItem>
                </SubMenu>
              </Tooltip>
              {/* VTS */}
              <Tooltip
                title="VTS"
                placement="right"
                disableHoverListener={!collapsed}
                arrow
              >
                <SubMenu
                  label={!collapsed ? "VTS" : ""}
                  icon={<IconTir className="h-5 w-6" stroke={1.5} />}
                >
                  <MenuItem
                    icon={<IconSmartHome className="h-5 w-6" stroke={1.5} />}
                    component={<Link to="/VTS/VTSHome" />}
                    className={isActive("/VTS/VTSHome") ? "ps-active" : ""}
                  >
                    VTS Violation Home
                  </MenuItem>
                    <MenuItem
                    icon={<IconSmartHome className="h-5 w-6" stroke={1.5} />}
                    component={<Link to="/VTS/VTSViolationHome" />}
                    className={isActive("/VTS/VTSViolationHome") ? "ps-active" : ""}
                  >
                    VTS Home
                  </MenuItem>
                  <MenuItem
                    icon={
                      <IconLayoutDashboard className="h-5 w-6" stroke={1.5} />
                    }
                    component={<Link to="/VTS/AlertManager" />}
                    className={isActive("/VTS/AlertManager") ? "ps-active" : ""}
                  >
                    Alert Manager
                  </MenuItem>
                </SubMenu>
              </Tooltip>

              {/* VA */}
              <Tooltip
                title="VA"
                placement="right"
                disableHoverListener={!collapsed}
                arrow
              >
                <SubMenu
                  label={!collapsed ? "VA" : ""}
                  icon={<IconDeviceAnalytics className="h-5 w-6" stroke={1.5} />}
                >
                  <MenuItem
                    icon={<IconSmartHome className="h-5 w-6" stroke={1.5} />}
                    component={<Link to="/VA/VAHome" />}
                    className={isActive("/VA/VAHome") ? "ps-active" : ""}
                  >
                    VA Home
                  </MenuItem>
                  <MenuItem
                    icon={
                      <IconLayoutDashboard className="h-5 w-6" stroke={1.5} />
                    }
                    component={<Link to="/VA/dashboard" />}
                    className={isActive("/VA/dashboard") ? "ps-active" : ""}
                  >
                    Dashboard
                  </MenuItem>
                </SubMenu>
              </Tooltip>

              <Tooltip
                title="LPG"
                placement="right"
                disableHoverListener={!collapsed}
                arrow
              >
                <SubMenu
                  label={!collapsed ? "LPG" : ""}
                  icon={<IconCylinder className="h-5 w-6" stroke={1.5} />}
                >
                  <MenuItem
                    icon={<IconSmartHome className="h-5 w-6" stroke={1.5} />}
                    component={<Link to="/LPG/plantDashboard" />}
                    className={
                      isActive("/LPG/plantDashboard") ? "ps-active" : ""
                    }
                  >
                    Plant
                  </MenuItem>
                  <MenuItem
                    icon={<IconSmartHome className="h-5 w-6" stroke={1.5} />}
                    component={<Link to="/LPG/LPGHome" />}
                    className={
                      isActive("/LPG/LPGHome") ? "ps-active" : ""
                    }
                  >
                    Home
                  </MenuItem>
                  <MenuItem
                    icon={<IconSmartHome className="h-5 w-6" stroke={1.5} />}
                    component={<Link to="/LPG/salesDashboard" />}
                    className={
                      isActive("/LPG/salesDashboard") ? "ps-active" : ""
                    }
                  >
                    Sales CDCMS
                  </MenuItem>
                  {/* Nested SubMenu under LPG is unreliable (content height 0 / not visible). Use two items instead. */}
                  <MenuItem
                    icon={<IconSmartHome className="h-5 w-6" stroke={1.5} />}
                    component={<Link to="/LPG/supplyChain/operations" />}
                    className={
                      isActive("/LPG/supplyChain/operations") ? "ps-active" : ""
                    }
                    title="LPG Supply Chain · Operations"
                  >
                    Supply Chain · Operations
                  </MenuItem>
                  <MenuItem
                    icon={<IconSmartHome className="h-5 w-6" stroke={1.5} />}
                    component={<Link to="/LPG/supplyChain/sales" />}
                    className={
                      isActive("/LPG/supplyChain/sales") ? "ps-active" : ""
                    }
                    title="LPG Supply Chain · Sales"
                  >
                    Supply Chain · Sales
                  </MenuItem>
                  <MenuItem
                    icon={<IconSmartHome className="h-5 w-6" stroke={1.5} />}
                    component={<Link to="/LPG/videoAnalytics" />}
                    className={
                      isActive("/LPG/videoAnalytics") ? "ps-active" : ""
                    }
                  >
                    Video Analytics
                  </MenuItem>

                  <MenuItem
                    icon={<IconSmartHome className="h-5 w-6" stroke={1.5} />}
                    component={<Link to="/LPG/analytics" />}
                    className={
                      isActive("/LPG/analytics") ? "ps-active" : ""
                    }
                  >
                    LPG Analytics
                  </MenuItem>
                  {/* <SubMenu
                    title={!collapsed ? "LPG Plant" : ""}
                    icon={
                      <IconBuildingFactory2 className="h-5 w-6" stroke={1.5} />
                    }
                  >
                    <MenuItem
                      icon={<IconSmartHome className="h-5 w-6" stroke={1.5} />}
                      component={<Link to="/LPG/Plant/video-analytics" />}
                      className={
                        isActive("/LPG/Plant/video-analytics")
                          ? "ps-active"
                          : ""
                      }
                    >
                      Video Analytics
                    </MenuItem>
                  </SubMenu> */}

                  {/* <SubMenu
                    title={!collapsed ? "LPG Sales" : ""}
                    icon={
                      <IconBuildingFactory2 className="h-5 w-6" stroke={1.5} />
                    }
                  >
                    <MenuItem
                      icon={<IconSmartHome className="h-5 w-6" stroke={1.5} />}
                      component={<Link to="/LPG/Sales/video-analytics" />}
                      className={
                        isActive("/LPG/Saless/video-analytics")
                          ? "ps-active"
                          : ""
                      }
                    >
                      Video Analytics
                    </MenuItem>
                  </SubMenu> */}

                  {/* <MenuItem
                    icon={
                      <IconLayoutDashboard className="h-5 w-6" stroke={1.5} />
                    }
                    component={<Link to="/LPG/CDCMS" />}
                    className={isActive("/LPG/CDCMS") ? "ps-active" : ""}
                  >
                    LPG CDCMS
                  </MenuItem> */}
                </SubMenu>
              </Tooltip>

              <Tooltip
                title="CEMS"
                placement="right"
                disableHoverListener={!collapsed}
                arrow
              >
                <SubMenu
                  label={!collapsed ? "CEMS" : ""}
                  icon={<IconDeviceDesktop className="h-5 w-6" stroke={1.5} />}
                >
                  <MenuItem
                    icon={<IconSmartHome className="h-5 w-6" stroke={1.5} />}
                    component={<Link to="/CEMS/home" />}
                    className={isActive("/dnc/home/wall") ? "ps-active" : ""}
                  >
                    Home
                  </MenuItem>
                  <MenuItem
                    icon={<IconScreenShare className="h-5 w-6" stroke={1.5} />}
                    component={<Link to="/CEMS/screens" />}
                    className={isActive("/CEMS/screens") ? "ps-active" : ""}
                  >
                    Screens
                  </MenuItem>
                </SubMenu>
              </Tooltip>

              {/* LPG Plant */}
              {/* <Tooltip title="LPG Plant" placement="right" disableHoverListener={!collapsed} arrow>
            <SubMenu 
              title={!collapsed ? "LPG Plant" : ""} 
              icon={<IconCylinder className="h-5 w-6" stroke={1.5}  />}
            >
              <MenuItem 
                icon={<IconSmartHome className="h-5 w-6" stroke={1.5}  />}
                component={<Link to="/LPGPlant/LPGHome" />}
                className={isActive('/LPGPlant/LPGHome') ? 'ps-active' : ''}
              >
                LPG Home
              </MenuItem>
              <MenuItem 
                icon={<IconLayoutDashboard className="h-5 w-6" stroke={1.5}  />}
                component={<Link to="/LPGPlant/dashboard" />}
                className={isActive('/LPGPlant/dashboard') ? 'ps-active' : ''}
              >
                Dashboard
              </MenuItem>
              <MenuItem 
                icon={<IconDeviceAnalytics className="h-5 w-6" stroke={1.5}  />}
                component={<Link to="/LPGPlant/videoAnalytics" />}
                className={isActive('/LPGPlant/videoAnalytics') ? 'ps-active' : ''}
              >
                Video Analytics
              </MenuItem>
              <MenuItem 
                icon={<IconCurrentLocation className="h-5 w-6" stroke={1.5}  />}
                component={<Link to="/LPGPlant/LPGPalntOps" />}
                className={isActive('/LPGPlant/videoAnalytics') ? 'ps-active' : ''}
              >
                LPG Plant Operations
              </MenuItem>
            </SubMenu>
          </Tooltip> */}

              {/* Consumer Pump */}
              <Tooltip
                title="Consumer Pump"
                placement="right"
                disableHoverListener={!collapsed}
                arrow
              >
                <SubMenu
                  label={!collapsed ? "Consumer Pump" : ""}
                  icon={
                    <IconBuildingFactory2 className="h-5 w-6" stroke={1.5} />
                  }
                >
                  <MenuItem
                    icon={<IconSmartHome className="h-5 w-6" stroke={1.5} />}
                    component={<Link to="/consumerPump/cpHome" />}
                    className={
                      isActive("/consumerPump/cpHome") ? "ps-active" : ""
                    }
                  >
                    CP Home
                  </MenuItem>
                </SubMenu>
              </Tooltip>

              {/* RDI */}
              <Tooltip
                title="RCD"
                placement="right"
                disableHoverListener={!collapsed}
                arrow
              >
                <SubMenu
                  label={!collapsed ? "RCD" : ""}
                  icon={<IconTrain className="h-5 w-6" stroke={1.5} />}
                >
                  <MenuItem
                    icon={<IconSmartHome className="h-5 w-6" stroke={1.5} />}
                    component={<Link to="/rdi/rdiHome" />}
                    className={
                      isActive("/consumerPump/cpHome") ? "ps-active" : ""
                    }
                  >
                    RCD Home
                  </MenuItem>
                </SubMenu>
              </Tooltip>



              {/* Configurations */}

              <Tooltip
                title="Masters"
                placement="right"
                disableHoverListener={!collapsed}
                arrow
              >
                <SubMenu
                  label={!collapsed ? "Masters" : ""}
                  icon={<IconTheater className="h-5 w-6" stroke={1.5} />}
                >
                  <MenuItem
                    icon={<IconMap2 className="h-5 w-6" stroke={1.5} />}
                    component={<Link to="/masters/locationMasters" />}
                    className={
                      isActive("/masters/locationMasters") ? "ps-active" : ""
                    }
                  >
                    Location Masters
                  </MenuItem>
                  <MenuItem
                    icon={<IconUsers className="h-5 w-6" stroke={1.5} />}
                    component={<Link to="/masters/roleMasters" />}
                    className={
                      isActive("/masters/roleMasters") ? "ps-active" : ""
                    }
                  >
                    Role Masters
                  </MenuItem>
                  <MenuItem
                    icon={<IconAssembly className="h-5 w-6" stroke={1.5} />}
                    component={<Link to="/masters/assetMasters" />}
                    className={
                      isActive("/masters/assetMasters") ? "ps-active" : ""
                    }
                  >
                    Asset Masters
                  </MenuItem>
                  <MenuItem
                    icon={<IconAssembly className="h-5 w-6" stroke={1.5} />}
                    component={<Link to="/masters/stateCodeMasters" />}
                    className={
                      isActive("/masters/stateCodeMasters") ? "ps-active" : ""
                    }
                  >
                    State Code Masters
                  </MenuItem>
                </SubMenu>
              </Tooltip>

              {/* Settings */}
              <Tooltip
                title="Settings"
                placement="right"
                disableHoverListener={!collapsed}
                arrow
              >
                <SubMenu
                  label={!collapsed ? "Settings" : ""}
                  icon={<IconSettings className="h-5 w-6" stroke={1.5} />}
                >
                  {/* Analytical Studio SubMenu */}
                  <SubMenu
                    label="Analytical-Studio"
                    icon={
                      <IconLayoutDashboard className="h-5 w-6" stroke={1.5} />
                    }
                  >
                    <MenuItem
                      icon={<IconChartLine className="h-5 w-6" stroke={1.5} />}
                      component={<Link to="/action-center/dashboards" />}
                      className={
                        isActive("/action-center/dashboards") ? "ps-active" : ""
                      }
                    >
                      Global Insights
                    </MenuItem>
                    <MenuItem
                      icon={
                        <IconAdjustments className="h-5 w-6" stroke={1.5} />
                      }
                      component={<Link to="/action-center/charts" />}
                      className={
                        isActive("/action-center/charts") ? "ps-active" : ""
                      }
                    >
                      Widgets
                    </MenuItem>
                    <MenuItem
                      icon={
                        <IconAdjustments className="h-5 w-6" stroke={1.5} />
                      }
                      component={<Link to="/action-center/groups" />}
                      className={
                        isActive("/action-center/groups") ? "ps-active" : ""
                      }
                    >
                      Groups
                    </MenuItem>
                  </SubMenu>
                  <MenuItem
                    icon={<IconBell className="h-5 w-6" stroke={1.5} />}
                    component={<Link to="/settings/notification" />}
                    className={
                      isActive("/settings/notification") ? "ps-active" : ""
                    }
                  >
                    Notification
                  </MenuItem>
                  <MenuItem
                    icon={
                      <IconAlertSquareRounded
                        className="h-5 w-6"
                        stroke={1.5}
                      />
                    }
                    component={<Link to="/settings/alerts" />}
                    className={isActive("/settings/alerts") ? "ps-active" : ""}
                  >
                    Alerts
                  </MenuItem>
                  <MenuItem
                    icon={
                      <IconAlertSquareRounded
                        className="h-5 w-6"
                        stroke={1.5}
                      />
                    }
                    component={<Link to="/settings/alerts" />}
                    className={isActive("/settings/alerts") ? "ps-active" : ""}
                  >
                    DNC Settings
                  </MenuItem>
                  <MenuItem
                    icon={
                      <IconUserSquareRounded className="h-5 w-6" stroke={1.5} />
                    }
                    component={<Link to="/settings/users" />}
                    className={isActive("/settings/users") ? "ps-active" : ""}
                  >
                    Users
                  </MenuItem>
                  <MenuItem
                    icon={<IconUserCog className="h-5 w-6" stroke={1.5} />}
                    component={<Link to="/settings/roles" />}
                    className={isActive("/settings/roles") ? "ps-active" : ""}
                  >
                    Roles
                  </MenuItem>
                  <MenuItem
                    icon={<IconHistory className="h-5 w-6" stroke={1.5} />}
                    component={<Link to="/settings/jobs" />}
                    className={isActive("/settings/jobs") ? "ps-active" : ""}
                  >
                    Jobs
                  </MenuItem>

                  <SubMenu
                    label={!collapsed ? "Configurations" : ""}
                    icon={<IconAdjustmentsHorizontal stroke={1.5} />}
                  >
                    <MenuItem
                      icon={<IconHierarchy2 className="h-5 w-6" stroke={1.5} />}
                      component={<Link to="/configuration/dataflow" />}
                      className={
                        isActive("/configuration/dataflow") ? "ps-active" : ""
                      }
                    >
                      Dataflow
                    </MenuItem>
                    <MenuItem
                      icon={
                        <IconPlugConnectedX className="h-5 w-6" stroke={1.5} />
                      }
                      component={<Link to="/configuration/vault" />}
                      className={
                        isActive("/configuration/vault") ? "ps-active" : ""
                      }
                    >
                      Connection Vault
                    </MenuItem>
                    <MenuItem
                      icon={
                        <IconFileDatabase className="h-5 w-6" stroke={1.5} />
                      }
                      component={<Link to="/configuration/master-data" />}
                      className={
                        isActive("/configuration/master-data")
                          ? "ps-active"
                          : ""
                      }
                    >
                      Master Data
                    </MenuItem>
                    <MenuItem
                      icon={
                        <IconFileDatabase className="h-5 w-6" stroke={1.5} />
                      }
                      component={<Link to="/configuration/jobs" />}
                      className={
                        isActive("/configuration/jobs") ? "ps-active" : ""
                      }
                    >
                      Jobs
                    </MenuItem>
                    <MenuItem
                      icon={<IconContract className="h-5 w-6" stroke={1.5} />}
                      component={<Link to="/configuration/config" />}
                      className={
                        isActive("/configuration/config") ? "ps-active" : ""
                      }
                    >
                      Validation Config
                    </MenuItem>
                  </SubMenu>

                  <SubMenu
                    className="text-[0.789rem]"
                    label={!collapsed ? "User" : ""}
                    icon={<IconSettings className="h-5 w-6" stroke={1.5} />}
                  >
                    <MenuItem
                      className="text-[0.789rem]"
                      icon={
                        <IconBrandCodesandbox
                          className="h-5 w-6"
                          stroke={1.5}
                        />
                      }
                      component={<Link to="/configuration/notifications" />}
                    >
                      Profile
                    </MenuItem>
                    <MenuItem
                      className="text-[0.789rem]"
                      icon={
                        <IconBrandCodesandbox
                          className="h-5 w-6"
                          stroke={1.5}
                        />
                      }
                      component={<Link to="/configuration/alerts" />}
                    >
                      Edit Profile
                    </MenuItem>
                    <MenuItem
                      className="text-[0.789rem]"
                      icon={
                        <IconBrandCodesandbox
                          className="h-5 w-6"
                          stroke={1.5}
                        />
                      }
                      component={<Link to="/configuration/user" />}
                    >
                      Setting
                    </MenuItem>
                    <MenuItem
                      className="text-[0.789rem]"
                      icon={
                        <IconBrandCodesandbox
                          className="h-5 w-6"
                          stroke={1.5}
                        />
                      }
                      component={<Link to="/configuration/roles" />}
                    >
                      Logout
                    </MenuItem>
                  </SubMenu>

                  <MenuItem
                    icon={<IconLogs className="h-5 w-6" stroke={1.5} />}
                    component={<Link to="/changelog" />}
                    className={isActive("/changelog") ? "ps-active" : ""}
                  >
                    {!collapsed && "Changelog"}
                  </MenuItem>
                  <MenuItem
                    icon={<IconChecklist className="h-5 w-6" stroke={1.5} />}
                    component={<Link to="/documentation" />}
                    className={isActive("/documentation") ? "ps-active" : ""}
                  >
                    {!collapsed && "Documentation"}
                  </MenuItem>
                </SubMenu>
              </Tooltip>
            </Menu>

            <hr />

            {/* Bottom Section - Toggle Button */}
            <Menu menuItemStyles={menuItemStyles}>
              <MenuItem
                icon={
                  collapsed ? (
                    <IconLayoutSidebarLeftExpand className="h-5 w-6" stroke={1.5} />
                  ) : (
                    <IconLayoutSidebarRightExpand className="h-5 w-6" stroke={1.5} />
                  )
                }
                onClick={handleToggleSidebar}
              >
                {!collapsed && (
                  <span style={{ marginLeft: '8px' }}>
                    {collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                  </span>
                )}
              </MenuItem>
            </Menu>
          </Sidebar>
        </Box>

        {/* Main Content Area */}
        <Box
          as="main"
          flex="1"
          p="4"
          bg={colorConfigs.mainBg}
          transition="width 0.3s ease-in-out"
          width={
            collapsed
              ? `calc(100% - ${sizeConfigs.sidebar.mobileWidth})`
              : `calc(100% - ${sizeConfigs.sidebar.width})`
          }
          marginLeft={collapsed ? `14px` : ``}
          overflow="scroll"
          h="calc(100vh - 60px)"
        >
          <Outlet />
        </Box>
      </Flex>
    </Box>
  );
};

export default MainLayout;