
import { Layout } from "react-grid-layout";
import { Widget } from "../../types/DashbordTypes";

export const onLayoutChangeUtils = (
    newLayout: Layout[],
    setLayout: React.Dispatch<React.SetStateAction<Layout[]>>,
    setCompactType: React.Dispatch<React.SetStateAction<"vertical" | "horizontal">>,
    setWidgets: React.Dispatch<React.SetStateAction<Widget[]>>
  ) => {
    setLayout(newLayout);
    setCompactType((prevType) =>
      prevType === "vertical" ? "horizontal" : "vertical"
    );
  
    setWidgets((prevWidgets) =>
      prevWidgets.map((widget) => {
        const updatedLayoutItem = newLayout.find(
          (item) => item.i === widget.i.toString()
        );
        if (updatedLayoutItem) {
          return {
            ...widget,
            x: updatedLayoutItem.x,
            y: updatedLayoutItem.y,
            w: updatedLayoutItem.w,
            h: updatedLayoutItem.h,
          };
        }
        return widget;
      })
    );
  };