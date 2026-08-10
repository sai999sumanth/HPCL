import React from 'react';
import TerminalHome from '../TerminalHome';

const TASdash: React.FC = () => {
  return (
    <TerminalHome
      visibleSections={["TAS"]}
      preventCardNavigation
      defaultAlertSection="TAS"
    />
  );
};

export default TASdash;
