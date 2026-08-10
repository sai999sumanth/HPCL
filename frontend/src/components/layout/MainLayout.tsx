import React, { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Sidebar, Menu, MenuItem, SubMenu } from 'react-pro-sidebar';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Tooltip, Zoom } from '@mui/material';
import * as TablerIcons from '@tabler/icons-react';
import { Fuel } from 'lucide-react';
import { TbReportAnalytics } from 'react-icons/tb';
import menuData from './menuData.json';
import TopBarComponent from './TopBar';
import { Box, Flex, IconButton } from '@chakra-ui/react';
import colorConfigs from "../../configs/colorConfigs";
import sizeConfigs from "../../configs/sizeConfigs";
import useMenuStore from '@/store/menuStore';
import useAuthStore from '@/store/authStore';

// Custom hook to replace useBreakpointValue
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 992); // lg breakpoint is typically 992px
    };

    // Check on mount
    checkIsMobile();

    // Add event listener
    window.addEventListener('resize', checkIsMobile);

    // Cleanup
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  return isMobile;
};

// Type definitions
interface MenuItemType {
  title: string;
  icon: string;
  path?: string;
  type: 'item' | 'submenu';
  children?: MenuItemType[];
  hidden?: boolean;
}

interface DynamicMenuProps {
  menuItems: any[];
  collapsed: boolean;
  menuStyles: any;
}

const LUCIDE_MENU_ICONS: Record<string, React.ElementType> = {
  Fuel,
};

const REACT_ICONS_MENU: Record<string, React.ElementType> = {
  TbReportAnalytics,
};

// Dynamic Icon Component
const DynamicIcon = ({ iconName }: { iconName: string }) => {
  const LucideIcon = LUCIDE_MENU_ICONS[iconName];
  if (LucideIcon) {
    return <LucideIcon className="h-5 w-6" strokeWidth={1.5} />;
  }
  const ReactIcon = REACT_ICONS_MENU[iconName];
  if (ReactIcon) {
    return <ReactIcon className="h-5 w-6" />;
  }
  const Icon = (TablerIcons as any)[iconName];
  return Icon ? <Icon className="h-5 w-6" stroke={1.5} /> : null;
};

/** Indent leaf / nested submenu rows (e.g. Operations & Sales under Supply Chain under LPG). */
const getIndentedRootStyles = (baseRoot: Record<string, unknown>, level: number) => {
  if (level <= 1) return baseRoot;
  const btn = baseRoot["& .ps-menu-button"] as Record<string, unknown> | undefined;
  const extraPad = 26 + (level - 2) * 12;
  return {
    ...baseRoot,
    marginLeft: `${14 + (level - 2) * 8}px`,
    "& .ps-menu-button": {
      ...(btn && typeof btn === "object" ? btn : {}),
      paddingLeft: `${extraPad}px !important`,
    },
  };
};

// Custom MenuItem with ref forwarding
const CustomMenuItem = forwardRef(
  (
    {
      item,
      collapsed,
      menuStyles,
      isActive,
      onMobileClose,
      level = 0,
      ...props
    }: any,
    ref
  ) => (
    <MenuItem
      ref={ref}
      icon={<DynamicIcon iconName={item.icon} />}
      component={<Link to={item.path || ""} />}
      className={`${isActive(item.path) ? "ps-active" : ""}${
        level > 1 ? " ps-nested-submenu-leaf" : ""
      }`.trim()}
      rootStyles={getIndentedRootStyles(menuStyles.root, level)}
      onClick={onMobileClose} // Close sidebar on mobile when menu item is clicked
      {...props}
    >
      {item.title}
    </MenuItem>
  )
);

// Custom SubMenu with ref forwarding
const CustomSubMenu = forwardRef(
  (
    {
      item,
      collapsed,
      menuStyles,
      children,
      level = 0,
      ...props
    }: any,
    ref
  ) => (
    <SubMenu
      ref={ref}
      label={item.title}
      icon={<DynamicIcon iconName={item.icon} />}
      rootStyles={getIndentedRootStyles(menuStyles.root, level)}
      {...props}
    >
      {children}
    </SubMenu>
  )
);

// Recursive Menu Item Component
const RecursiveMenuItem = ({
  item,
  collapsed,
  menuStyles,
  level = 0,
  onMobileClose,
}: {
  item: MenuItemType & { hidden?: boolean };
  collapsed: boolean;
  menuStyles: any;
  level?: number;
  onMobileClose?: () => void;
}) => {
  const location = useLocation();

  // If item is hidden, don't render anything
  if (item.hidden) {
    return null;
  }

  const isActive = (path?: string) => {
    return path ? location.pathname === path : false;
  };

  if (item.type === "item") {
    return (
      <Tooltip
        title={collapsed ? item.title : ""}
        placement="right"
        TransitionComponent={Zoom}
        arrow
      >
        <div>
          <CustomMenuItem
            item={item}
            collapsed={collapsed}
            menuStyles={menuStyles}
            isActive={isActive}
            onMobileClose={onMobileClose}
            level={level}
          />
        </div>
      </Tooltip>
    );
  }

  // For submenu, filter out hidden children
  const visibleChildren = item.children?.filter((child) => !child.hidden);

  // If no visible children, don't render the submenu
  if (visibleChildren?.length === 0) {
    return null;
  }

  return (
    <Tooltip
      title={collapsed ? item.title : ""}
      placement="right"
      TransitionComponent={Zoom}
      arrow
    >
      <div>
        <CustomSubMenu
          item={item}
          collapsed={collapsed}
          menuStyles={menuStyles}
          level={level}
        >
          {visibleChildren?.map((child, index) => (
            <RecursiveMenuItem
              key={`${child.title}-${index}`}
              item={child}
              collapsed={collapsed}
              menuStyles={menuStyles}
              level={level + 1}
              onMobileClose={onMobileClose}
            />
          ))}
        </CustomSubMenu>
      </div>
    </Tooltip>
  );
};

// Main Dynamic Menu Component
const DynamicMenu: React.FC<DynamicMenuProps & { onMobileClose?: () => void }> = ({ 
  menuItems, 
  collapsed, 
  menuStyles,
  onMobileClose
}) => {
  // Filter out hidden top-level items
  const visibleMenuItems = menuItems.filter(item => !item.hidden);

  return (
    <Menu
      closeOnClick={true}
      menuItemStyles={menuStyles}
      className="h-[85vh] overflow-scroll hide-scrollbar"
    >
      {visibleMenuItems.map((item, index) => (
        <RecursiveMenuItem
          key={`${item.title}-${index}`}
          item={item}
          collapsed={collapsed}
          menuStyles={menuStyles}
          onMobileClose={onMobileClose}
        />
      ))}
    </Menu>
  );
};

// Mobile Menu Toggle Button Component
const MobileMenuToggle = ({ isOpen, onToggle, isMobile }: { isOpen: boolean; onToggle: () => void; isMobile: boolean }) => {
  if (!isMobile) return null;
  
  return (
    <IconButton
      aria-label="Toggle mobile menu"
      icon={<DynamicIcon iconName={isOpen ? "IconX" : "IconMenu2"} />}
      onClick={onToggle}
      variant="ghost"
      size="md"
      position="fixed"
      padding="4px"
      top="1rem"
      left="5rem"
      zIndex={50}
      bg="white"
      shadow="md"
      borderRadius="4px"
      _hover={{ bg: "gray.100" }}
      border="1px solid #E2E8F0"
      borderColor="#E2E8F0"
    />
  );
};

// Main Sidebar Component
const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Main content scrolls inside this Box, not on window — reset to top on each route change
  useLayoutEffect(() => {
    mainScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  // Use custom hook instead of useBreakpointValue
  const isMobile = useIsMobile();
  
  const menuStyles = {
    root: {
      fontSize: '0.700rem',
      margin: 0,
      padding: 0,
      '& .ps-menu-button': {
        height: '36px !important',
        minHeight: '36px !important',
        borderRadius: '9999px',
        margin: '2px 0',
        '&:hover': {
          background: 'linear-gradient(90deg, #4AA1FF 0%, #4AA1FF 10%, #4AA1FF 50%, #4AA1FF 80%, #0284C7 100%)',
          color: 'white !important',
          '& svg': {
            color: 'white !important'
          }
        },
      },
      '& .ps-menu-icon': {
        marginRight: '6px !important'
      },
      '&.ps-active > .ps-menu-button': {
        background: 'linear-gradient(90deg, #4AA1FF 0%, #4AA1FF 10%, #4AA1FF 50%, #4AA1FF 80%, #0284C7 100%)',
        borderRadius: '9999px',
        color: 'white',
        '& svg': {
          color: 'white'
        }
      }
    },
    icon: {
      color: '#4AA1FF',
      marginRight: '12px'
    },
    subMenuContent: {
      backgroundColor: colorConfigs.sidebar.bg,
      borderRadius: '0 8px 8px 0',
      boxShadow: 'none',
      marginLeft: 0,
      border: 'none',
      '& .ps-menu-button': {
        borderRadius: '9999px',
        height: '36px !important',
        margin: '2px 6px',
      }
    },
    button: {
      borderRadius: '9999px',
      margin: '2px 0',
      '&:hover': {
        background: 'linear-gradient(90deg, #4AA1FF 0%, #4AA1FF 10%, #4AA1FF 50%, #4AA1FF 80%, #0284C7 100%)',
        color: 'white',
        '& svg': {
          color: 'white'
        }
      }
    }
  };

  const { filteredMenu, setAllowedMenu } = useMenuStore();
  const user = useAuthStore(state => state.user);

  useEffect(() => {
    if (user?.allowedPages) {
      const allowed_menu: any[] = user?.allowedPages;
      setAllowedMenu(allowed_menu);
    }
  }, [user]);

  // Close mobile menu when clicking outside or on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };

    if (isMobile && mobileMenuOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden'; // Prevent background scroll
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen, isMobile]);

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    if (isMobile) {
      setCollapsed(true);
    }
  }, [isMobile]);

  const handleMobileMenuClose = () => {
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  // Custom MenuItem with ref forwarding for toggle button
  const ToggleMenuItem = forwardRef((props: any, ref) => (
    <MenuItem
      ref={ref}
      icon={
        collapsed ? (
          <DynamicIcon iconName="IconLayoutSidebarLeftExpand" />
        ) : (
          <DynamicIcon iconName="IconLayoutSidebarRightExpand" />
        )
      }
      onClick={() => setCollapsed(!collapsed)}
      {...props}
    >
      {!collapsed && (
        <span style={{ marginLeft: '8px' }}>
          {collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        </span>
      )}
    </MenuItem>
  ));

  return (
    <>
      <TopBarComponent />
      
      {/* Mobile Menu Toggle Button */}
      <MobileMenuToggle 
        isOpen={mobileMenuOpen} 
        onToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        isMobile={isMobile}
      />

      {/* Mobile Overlay */}
      {isMobile && mobileMenuOpen && (
        <Box
          position="fixed"
          top="0"
          left="0"
          right="0"
          bottom="0"
          bg="blackAlpha.600"
          zIndex="modal"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <Flex pt="62px" h="100vh">
        <Box
          as="nav"
          className="hide-scrollbar"
          w={
            isMobile
              ? mobileMenuOpen
                ? sizeConfigs.sidebar.width
                : "0"
              : collapsed
              ? sizeConfigs.sidebar.mobileWidth
              : sizeConfigs.sidebar.width
          }
          flexShrink={0}
          transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
          bg={colorConfigs.sidebar.bg}
          position={isMobile ? "fixed" : "relative"}
          top={isMobile ? "62px" : "auto"}
          left={isMobile ? "0" : "auto"}
          height={isMobile ? "calc(100vh - 62px)" : "auto"}
          zIndex={isMobile ? "999" : "50"}
          overflow="hidden"
          transform={
            isMobile
              ? mobileMenuOpen
                ? "translateX(0)"
                : "translateX(-100%)"
              : "none"
          }
        >
          <Sidebar
            collapsed={isMobile ? false : collapsed}
            width={sizeConfigs.sidebar.width}
            collapsedWidth={sizeConfigs.sidebar.mobileWidth}
            rootStyles={{
              '& .ps-sidebar-container': {
                backgroundColor: 'white',
                height: '100%',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                padding: '4px 3px',
                boxSizing: 'border-box',
              },
              '& .ps-sidebar-container::-webkit-scrollbar': {
                display: 'none',
              },
              '& .ps-menu': {
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                padding: 0,
                margin: 0,
              },
              '& .ps-menu::-webkit-scrollbar': {
                display: 'none',
              },
              '& .ps-menuitem-root': {
                margin: 0,
                padding: 0,
              },
              '& .ps-menu-button': {
                borderRadius: '9999px',
                margin: '2px 0',
                height: '36px',
                minHeight: '36px',
              },
            }}
          >
            <DynamicMenu
              menuItems={filteredMenu}
              collapsed={isMobile ? false : collapsed}
              menuStyles={menuStyles}
              onMobileClose={handleMobileMenuClose}
            />
            
            {/* Toggle Button - Hide on mobile */}
            {!isMobile && (
              <Menu menuItemStyles={menuStyles}>
                <Tooltip
                  title={collapsed ? 'Toggle Sidebar' : ''}
                  placement="right"
                  TransitionComponent={Zoom}
                  arrow
                >
                  <div>
                    <ToggleMenuItem />
                  </div>
                </Tooltip>
              </Menu>
            )}
          </Sidebar>
        </Box>

        {/* Main Content Area - no top padding so content sits under TopBar */}
        <Box
          ref={mainScrollRef}
          as="main"
          flex="1"
          pt="0"
          px="4"
          pb="4"
          bg={colorConfigs.mainBg}
          transition="width 0.3s ease-in-out"
          width={
            isMobile
              ? "100%"
              : collapsed
              ? `calc(100% - ${sizeConfigs.sidebar.mobileWidth})`
              : `calc(100% - ${sizeConfigs.sidebar.width})`
          }
          marginLeft={
            isMobile
              ? "0"
              : collapsed
              ? "6px"
              : ""
          }
          overflow="scroll"
          h="calc(100vh - 60px)"
          className="hide-scrollbar"
        >
          <Outlet />
        </Box>
      </Flex>
    </>
  );
};

export default MainLayout;