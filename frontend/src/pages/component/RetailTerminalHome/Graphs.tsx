import React, { useState } from 'react';
import { Card, CardContent } from "../../../@/components/ui/card";
import { Button } from '../../../@/components/ui/button';
import { ROAlertsTable } from '../alertsTable/ROAlertsTable';
import { AlertActionTable } from '../alertsTable/AlertActionTable';
import { useNavigate } from 'react-router-dom';

interface Location {
  name: string;
  sap_id: string;
  zone: string;
  city: string;
  state: string;
  region: string;
}

interface LocationDetailsProps {
  location: Location;
  onBackToHome: () => void;
}

const LocationDetails: React.FC<LocationDetailsProps> = ({ location }) => {
  const [activeTab, setActiveTab] = useState(0);
  const navigate = useNavigate();

  const handleTabChange = (index: number) => {
    setActiveTab(index);
  };

  const handleBackToHome = () => {
    navigate('/retailOutlet/RO-Home');
  };

  return (
    <div className="p-1 space-y-6 bg-slate-100">
      <Card className="w-full">
        <CardContent className="p-2">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-bold ml-2">{location.name}</h2>
            <Button variant="outline" onClick={handleBackToHome}>
              Back 
            </Button>
          </div>

          <div className="w-full">
            <div className="bg-white border-b">
              <div className="flex">
                {['Open Alerts', 'Closed Alerts', 'Inbox'].map((tab, index) => (
                  <button
                    key={index}
                    onClick={() => handleTabChange(index)}
                    className={`px-6 py-3 font-medium relative transition-colors ${
                      activeTab === index ? 'text-blue-600' : 'text-gray-600'
                    }`}
                  >
                    <span className="relative">
                      {tab}
                      {activeTab === index && (
                        <span className="absolute bottom-[-12px] left-0 w-full h-0.5 bg-blue-600" />
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white pt-6" >
              {activeTab === 0 && (
                <ROAlertsTable query={`sap_id='${location.sap_id}' AND alert_status='Open'`} />
              )}
              {activeTab === 1 && (
                <ROAlertsTable query={`sap_id='${location.sap_id}' AND alert_status='Closed'`} />
              )}
              {activeTab === 2 && (
                <ROAlertsTable query={`sap_id='${location.sap_id}'`} />
              )}
            </div>

          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LocationDetails;