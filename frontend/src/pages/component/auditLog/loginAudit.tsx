import React, { useState, useCallback } from 'react';
import { Users, LogIn, LogOut, ShieldX } from 'lucide-react';
import AuditTable from './AuditTable';

const StatCard: React.FC<{ icon: React.ElementType, title: string, value: number, color: string }> = ({ icon: Icon, title, value, color }) => {
    const colorClasses = {
        text: {
            blue: 'text-blue-600',
            green: 'text-green-600',
            yellow: 'text-yellow-600',
            red: 'text-red-600',
        },
        bg: {
            blue: 'bg-blue-100',
            green: 'bg-green-100',
            yellow: 'bg-yellow-100',
            red: 'bg-red-100',
        }
    };
    const textColor = colorClasses.text[color as keyof typeof colorClasses.text] || 'text-gray-600';
    const bgColor = colorClasses.bg[color as keyof typeof colorClasses.bg] || 'bg-gray-50';

    return (
        <div className={`p-1 px-2 rounded-lg flex items-center space-x-2.5 ${bgColor}`}>
            <Icon size={14} className={textColor} />
            <div>
                <p><span className="text-lg font-bold text-gray-800">{value}</span><span className="text-xs text-gray-500"> {title}</span></p>
            </div>
        </div>
    );
};

const LoginAudit: React.FC = () => {
  const [stats, setStats] = useState({ total: 0, loggedIn: 0, loggedOut: 0, failure: 0 });

  const handleDataLoaded = useCallback((data: any[], total: number) => {
    let loggedInCount = 0;
    let loggedOutCount = 0;
    let failureCount = 0;

    data.forEach(record => {
      const status = record.login_status ? String(record.login_status).toLowerCase() : '';
      if (status.includes('logged in')) {
        loggedInCount++;
      } else if (status.includes('logged out')) {
        loggedOutCount++;
      } else if (status.includes('failure')) {
        failureCount++;
      }
    });

    const displayTotal = total > 0 ? total : data.length;
    setStats({ total: displayTotal, loggedIn: loggedInCount, loggedOut: loggedOutCount, failure: failureCount });
  }, []);

  const statCards = (
    <div className="w-full sm:w-auto grid grid-cols-2 sm:grid-cols-4 lg:flex lg:flex-row gap-3">
      <StatCard icon={Users} title="Total" value={stats.total} color="blue" />
      <StatCard icon={LogIn} title="Logged In" value={stats.loggedIn} color="green" />
      <StatCard icon={LogOut} title="Logged Out" value={stats.loggedOut} color="yellow" />
      <StatCard icon={ShieldX} title="Failure" value={stats.failure} color="red" />
    </div>
  );

  return (
    <AuditTable
      apiEndpoint="/api/userloginaudit/fetch_login_audit"
      apiMethod="POST"
      pageTitle="Login Audit"
      searchPlaceholder="Search logs..."
      noRecordsMessage="Your search did not match any login records."
      loadingMessage="Loading audit logs..."
      statCards={statCards}
      onDataLoaded={handleDataLoaded}
    />
  );
};

export default LoginAudit;