import React from 'react';

type BarFooterProps = {
  footer?: React.ReactNode;
};

const BarFooter: React.FC<BarFooterProps> = ({ footer }) => {
  return <div className="mt-4">{footer}</div>;
};

export default BarFooter;
