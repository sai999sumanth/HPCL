
import React from 'react';
import { Card } from '@/@/components/ui/card';

export const LPGDateCard = () => {
  // Get yesterday's date in localized format
  const getYesterdayDate = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <Card className="w-full py-2 mb-2 text-center bg-gradient-to-r from-blue-500 to-purple-500 text-white">
      <h3 className="text-md font-bold text-white">
        {getYesterdayDate()}
      </h3>
    </Card>
  );
};

export const LPGNameCard = () => {
  return (
    <Card className="w-full py-2 mb-2 text-center bg-gradient-to-r from-blue-500 to-purple-500 text-white">
      <h3 className="text-md font-bold text-white">
        Financial Year [2024-2025]
      </h3>
    </Card>
  );
};
