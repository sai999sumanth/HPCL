import React from "react";
import { Card, CardContent, Typography, Box } from "@mui/material";

const SalesCards: React.FC = () => {
  return (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      gap={2}
      padding={2}
    >
      {/* Card 1 */}
      <Card
        sx={{
          width: "200px",
          borderRadius: "12px",
          boxShadow: 2,
          textAlign: "center",
        }}
      >
        <CardContent>
          <Typography variant="subtitle1" color="textSecondary">
            Current Year Sales (Cr)
          </Typography>
          <Typography variant="h4" color="textPrimary">
            1.25
          </Typography>
        </CardContent>
      </Card>

      {/* Card 2 */}
      <Card
        sx={{
          width: "200px",
          borderRadius: "12px",
          boxShadow: 2,
          textAlign: "center",
        }}
      >
        <CardContent>
          <Typography variant="subtitle1" color="textSecondary">
            Current Month Sales (Cr)
          </Typography>
          <Typography variant="h4" color="textPrimary">
            1.25
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SalesCards;
