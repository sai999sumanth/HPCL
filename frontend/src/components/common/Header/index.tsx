import { Box, IconButton, Badge } from "@chakra-ui/react";
import { IconBell } from "@tabler/icons-react";

const NotificationSection = () => {
  return (
    <IconButton
      variant="outline"
      aria-label="Notifications"
      className="primary-color"
      mr="3"
      px="2"
      icon={
        <Box position="relative">
          <Badge
          >
            4
          </Badge>
          <IconBell stroke={1} />
        </Box>
      }
    />
  );
};

export default NotificationSection;
