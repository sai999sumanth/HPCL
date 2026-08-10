import { Avatar, Box, Flex, List, Stack, Text } from "@chakra-ui/react";
import assets from "../../assets";
import colorConfigs from "../../configs/colorConfigs";
import sizeConfigs from "../../configs/sizeConfigs";
import appRoutes from "../../routes/appRoutes";
import SidebarItem from "./SidebarItem";
import SidebarItemCollapse from "./SidebarItemCollapse";

interface SidebarProps {
  isOpen: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen }) => {
  const drawerWidth = isOpen ? sizeConfigs.sidebar.width : sizeConfigs.sidebar.mobileWidth;

  return (
    <Box
      as="nav"
      w={drawerWidth}
      h="100vh"
      bg={colorConfigs.sidebar.bg}
      color={colorConfigs.sidebar.color}
      borderRight="1px solid #dad9dc"
      transition="width 0.3s ease-in-out"
      position="fixed"
      overflowY="auto"
      sx={{
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": {
          display: "none",
        },
        backdropFilter: "blur(4px)"
      }}
    >
      {/* Top Logo/Brand Section */}
      <Flex justify="center" align="center" p={1.5} borderBottom="1px solid #dad9dc">
        <Stack direction="row" justify="center" w="100%" align="center">
          <Avatar src={assets.images.logo} mr={isOpen ? "10px" : "0"} />
          {isOpen && <Text fontSize="1.5rem" fontWeight="bold">Datafusion</Text>}
        </Stack>
      </Flex>

      {/* Menu Items */}
      <Box as="div" mt={1}>
        <List spacing={0.5} p={0}>
          {appRoutes.map((route, index) =>
            route.sidebarProps ? (
              route.child ? (
                <SidebarItemCollapse item={route} isOpen={isOpen} key={index} />
              ) : (
                <SidebarItem item={route} isOpen={isOpen} key={index} />
              )
            ) : null
          )}
        </List>
      </Box>
    </Box>
  );
};

export default Sidebar;
