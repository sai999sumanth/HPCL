import { Box, Flex, Text, Button } from "@chakra-ui/react";
import colorConfigs from "../../configs/colorConfigs";
import sizeConfigs from "../../configs/sizeConfigs";
import NotificationSection from "./Header";
import GlobalSearch from "./GlobalSearch/GlobalSearch";
import { IconLayoutSidebarRightExpand, IconLayoutSidebarLeftExpand } from '@tabler/icons-react';
import { UserNav } from "./UserNav/UserNav";

interface TopbarProps {
  toggleSidebar: () => void;
  isOpen: boolean;
}

const Topbar: React.FC<TopbarProps> = ({ toggleSidebar, isOpen }) => {
  return (
    <Box
      as="header"
      position="fixed"
      top="0"
      left="0"
      w={isOpen ? `calc(100% - ${sizeConfigs.sidebar.width})` : `calc(100% - ${sizeConfigs.sidebar.mobileWidth})`}
      ml={isOpen ? sizeConfigs.sidebar.width : sizeConfigs.sidebar.mobileWidth}
      bg={colorConfigs.topbar.bg}
      color={colorConfigs.topbar.color}
      borderBottom="1px solid #dad9dc"
      transition="width 0.3s ease-in-out"
      zIndex="1000"
    >
      <Flex align="center" px={4} py={2} className="header z-[-1]">
        {/* Sidebar Toggle Button */}
        <Box mr={3}>
          <Button onClick={toggleSidebar} variant="ghost" size="sm" _hover={{ boxShadow: "md" }} className="primary-color">
            {isOpen ? (
              <IconLayoutSidebarRightExpand stroke={1.15} className="text-slate-700" />
            ) : (
              <IconLayoutSidebarLeftExpand stroke={1.15} className="text-slate-700 hover:text-white" />
            )}
          </Button>
        </Box>

        {/* Welcome Text */}
        <Box>
          <Text fontSize="sm" color="gray.600">Welcome,</Text>
          <Text fontSize="md" color="gray.800">Sakariya Anthony</Text>
        </Box>

        {/* Center Elements */}
        <Flex flex="1" justify="center">
          <GlobalSearch />
        </Flex>

        {/* Notification and User Navigation */}
        <Flex align="center">
          <NotificationSection />
          <UserNav />
        </Flex>
      </Flex>
    </Box>
  );
};

export default Topbar;
