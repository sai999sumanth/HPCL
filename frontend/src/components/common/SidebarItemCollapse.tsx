import { useEffect, useState } from "react";
import { Box, Divider, Flex, Icon, List, Text, Collapse } from "@chakra-ui/react";
import colorConfigs from "../../configs/colorConfigs";
import { RouteType } from "../../routes/config";
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import SidebarItem from "./SidebarItem";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../../redux/store";
import { setAppState } from "../../redux/features/appStateSlice";

type Props = {
  item: RouteType;
  isOpen: boolean;
};

const SidebarItemCollapse = ({ item, isOpen }: Props) => {
  const [open, setOpen] = useState(false);

  const dispatch: AppDispatch = useDispatch();
  const appState = useSelector((state: RootState) => state.app.appState);

  useEffect(() => {
    if (appState.includes(item.state)) {
      setOpen(true);
    }
  }, [appState, item, dispatch]);

  return item.sidebarProps ? (
    <>
      <Flex
        as="button"
        onClick={() => setOpen(!open)}
        align="center"
        p="2px 4px"
        mx="2px"
        my="1px"
        borderRadius="6px"
        bg={appState === item.state ? colorConfigs.sidebar.activeBg : "unset"}
        color={appState === item.state ? colorConfigs.sidebar.activeColor : colorConfigs.sidebar.color}
        _hover={{
          bg: "#67037a",
          color: "#fff",
        }}
      >
        {/* Left Indicator Bar */}
        <Box w="1px" h="18px" bg="white" borderRadius="lg" mr="2px" flexShrink={0} />

        {/* Icon */}
        <Box mr="4px" color={colorConfigs.sidebar.color} flexShrink={0}>
          {item.sidebarProps.icon && item.sidebarProps.icon}
        </Box>

        {/* Text */}
        <Text
          fontSize="0.875rem"
          lineHeight="1.25rem"
          display={isOpen ? "block" : "none"}
          flex="1"
        >
          {item.sidebarProps.displayText}
        </Text>

        {/* Chevron Icon */}
        <Icon as={open ? IconChevronUp : IconChevronDown} w={4} h={4} />
      </Flex>

      {/* Divider */}
      {open && (
        <Divider
          my="1"
          borderColor={colorConfigs.sidebar.activeBg}
          borderBottomLeftRadius="6px"
          borderBottomRightRadius="6px"
        />
      )}

      {/* Collapsible List */}
      <Collapse in={open} animateOpacity>
        <List styleType="none" m={0} p={0}>
          {item.child?.map((route, index) =>
            route.sidebarProps ? (
              route.child ? (
                <SidebarItemCollapse item={route} isOpen={isOpen} key={index} />
              ) : (
                <SidebarItem item={route} isOpen={isOpen} key={index} />
              )
            ) : null
          )}
        </List>
      </Collapse>
    </>
  ) : null;
};

export default SidebarItemCollapse;
