import React from 'react';
import { Ticketing2Dashboard } from './components/Ticketing2Dashboard';

/**
 * Ticketing2 screen – stage-based board (Open, Escalated, Updated by Initiator, Returned by Occ, Reviewed by Occ).
 */
export function Ticketing2Screen() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Ticketing2Dashboard />
    </div>
  );
}

export default Ticketing2Screen;
