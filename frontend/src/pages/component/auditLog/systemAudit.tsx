import React from 'react';
import AuditTable from './AuditTable';

const SystemAudit: React.FC = () => {
  return (
    <AuditTable
      apiEndpoint="/api/systemauditlog"
      apiMethod="GET"
      pageTitle="System Audit"
      searchPlaceholder="Search system logs..."
      noRecordsMessage="Your search did not match any system records."
      loadingMessage="Loading system logs..."
      fields={['employee_id', 'action_model',  'bu', 'action', 'created_at', 'remarks','role', 'email']}
      fieldLabels={{
        employee_id: 'Acted by',
        action_model: 'Action type',
        created_at: 'Acted at',
      }}
    />
  );
};

export default SystemAudit;