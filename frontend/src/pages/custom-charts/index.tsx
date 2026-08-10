import React from 'react';
import ChartWrapper from './ChartWrapper';

export default function CustomWidget( props: any ) {
  return (
    <>
      <h1>Custom Widget</h1>
      <div className="container">
        <ChartWrapper></ChartWrapper>
      </div>
    </>
  );
}   
