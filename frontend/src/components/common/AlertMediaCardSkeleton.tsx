import React from 'react';
import { Card, CardContent } from '@/@/components/ui/card';

const AlertMediaCardSkeleton = () => (
  <div className="p-2 h-full">
    <Card className="w-full h-full">
      <CardContent className="flex flex-col p-3 h-full">
        <div className="flex justify-between items-start mb-2">
          <div className="flex flex-col gap-1 flex-1">
            <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2"></div>
          </div>
          <div className="h-6 w-6 bg-gray-200 rounded-full animate-pulse"></div>
        </div>
        <div className="w-full h-40 bg-gray-200 rounded-lg mb-4 animate-pulse"></div>
        <div className="flex flex-col gap-2">
          <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3"></div>
          <div className="flex justify-between">
            <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2"></div>
            <div className="h-3 bg-gray-200 rounded animate-pulse w-16"></div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
);

export default AlertMediaCardSkeleton;
