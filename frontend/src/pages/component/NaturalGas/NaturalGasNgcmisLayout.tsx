import React from "react";
import { Outlet } from "react-router-dom";

/** NGC routes: no shared hero — Analytics is bare; MIS supplies its own header in-page. */
const NaturalGasNgcmisLayout: React.FC = () => {
  return (
    <div className="bg-[radial-gradient(ellipse_100%_70%_at_50%_-15%,rgba(14,165,233,0.1),transparent)] px-0 pb-4 md:px-0">
      <div className="mx-auto max-w-full">
        <Outlet />
      </div>
    </div>
  );
};

export default NaturalGasNgcmisLayout;
