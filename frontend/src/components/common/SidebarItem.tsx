import { useEffect, useState } from "react";
import { Box, Flex, Text, Tooltip } from "@chakra-ui/react";
import { Provider, useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import colorConfigs from "../../configs/colorConfigs";
import store, { AppDispatch, RootState } from "../../redux/store";
import { RouteType } from "../../routes/config";
import { setAppState } from "../../redux/features/appStateSlice";

type Props = {
  item: RouteType;
  isOpen: boolean;
};

const SidebarItem = ({ item, isOpen }: Props) => {
  const dispatch: AppDispatch = useDispatch();
  const appState = useSelector((state: RootState) => state.app.appState);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Optional: Dispatch an action to update appState
    // dispatch(setAppState('new state value'));
  }, [dispatch]);

  const handleClose = () => {
    setOpen(false);
  };

  const handleOpen = () => {
    setOpen(true);
  };

  return (
    item.sidebarProps && item.path ? (
      <Provider store={store}>
        <Tooltip
          label={item.sidebarProps.displayText}
          isDisabled={isOpen}
          isOpen={open}
          onClose={handleClose}
          onOpen={handleOpen}
          bg="black"
          color="white"
          fontSize="12px"
          borderRadius="9px"
          placement="right"
          hasArrow
        >
          <Flex
            as={Link}
            to={item.path}
            align="center"
            p="2px 4px"
            mx="2px"
            my="2px"
            borderRadius="6px"
            bg={appState === item.state ? colorConfigs.sidebar.activeBg : "unset"}
            color={appState === item.state ? colorConfigs.sidebar.activeColor : colorConfigs.sidebar.color}
            boxShadow={appState === item.state ? '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)' : 'none'}
            _hover={{
              bg: colorConfigs.sidebar.hoverBg,
              color: colorConfigs.sidebar.hoverColor,
              boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
            }}
          >
            {isOpen ? (
              <Box
                w="1px"
                h="18px"
                bg={appState === item.state ? "white" : "gray.500"}
                borderRadius="full"
                mr="3px"
                flexShrink={0}
              />
            ) : (
              <Box w="2px" flexShrink={0} />
            )}

            <Box
              color={appState === item.state ? colorConfigs.sidebar.activeColor : "#67037a"}
              fontSize="1.5rem"
              mr={isOpen ? "4px" : "0"}
              display="flex"
              alignItems="center"
            >
              {item.sidebarProps.icon}
            </Box>

            {isOpen && (
              <Text
                fontSize="0.875rem"
                fontWeight={appState === item.state ? "semibold" : "medium"}
                color={appState === item.state ? colorConfigs.sidebar.activeColor : colorConfigs.sidebar.color}
              >
                {item.sidebarProps.displayText}
              </Text>
            )}
          </Flex>
        </Tooltip>
      </Provider>
    ) : null
  );
};

export default SidebarItem;
