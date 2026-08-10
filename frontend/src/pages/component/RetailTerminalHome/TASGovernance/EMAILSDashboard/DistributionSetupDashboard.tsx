
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mail } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/@/components/ui/select';
import { apiClient } from '@/services/apiClient';
import { toast } from "sonner";
import { ComposeRules } from './ComposeRule';
// import useAuthStore from '@/store/authStore';
interface EmailGroup {
  to: string[];
  cc: string[];
  bcc: string[];
}

interface ReportConfig {
  subject: string;
  body: string;
  emails: EmailGroup;
  name: string;
  description: string | null;
  enabled: boolean;
}

interface EmailNotificationConfig {
  subject: string;
  enabled: boolean;
  to_recipients: string[] | null;
  bcc_recipients: string[] | null;
  created_at: string;
  entity_id: number | null;
  bu: string;
  name: string;
  email_type: string;
  description: string | null;
  audience: string;
  cc_recipients: string[] | null;
  id: number;
  updated_at: string;
}

export type { EmailGroup, ReportConfig };

const REPORT_TYPE_BU_MAP: Record<string, string> = {
  retail: 'ro',
  nozzle: 'ro',
  clean: 'ro',
  lpg: 'lpg',
  sod: 'tas',
  daily: 'all',
  combined: 'all',
};

export const getBuForReportType = (reportType: string): string => {
  const lowerKey = Object.keys(REPORT_TYPE_BU_MAP).find(
    key => reportType.toLowerCase().includes(key)
  );
  return lowerKey ? REPORT_TYPE_BU_MAP[lowerKey] : 'RO';
};

const ENVIRONMENT_DISPLAY_LABELS: Record<string, string> = {
  chairman: 'Scheduled Report',
  employee: 'Test Report',
  testing: 'Dev Testing',
};

const ALLOWED_REPORT_TYPES = ['retail', 'lpg', 'sod', 'nozzle', 'clean', 'daily'];

const REPORT_TYPE_DISPLAY_LABELS: Record<string, string> = {
  retail: 'Novex Report - Retail',
  lpg: 'Novex Report - LPG',
  sod: 'Novex Report - SOD',
  nozzle: 'Novex Report - Nozzle Sales',
  clean: 'Novex Report - Clean',
  daily: 'Novex Report - Daily',
};

const getDisplayLabel = (emailType: string): string | null => {
  const matchedKey = ALLOWED_REPORT_TYPES.find(key =>
    emailType.toLowerCase().includes(key)
  );
  if (!matchedKey) return null;
  return REPORT_TYPE_DISPLAY_LABELS[matchedKey];
};

const DistributionSetupDashboard: React.FC = () => {
  const [reportType, setReportType] = useState<string | null>(null);
  //  const [environmentOptions] = useState<string[]>(['chairman', 'testing', 'employee']);
  const [environment, setEnvironment] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
const [appliedReportType, setAppliedReportType] = useState<string | null>(null);
const [environmentOptions, setEnvironmentOptions] = useState<string[]>([]);
  const [audienceDataStore, setAudienceDataStore] = useState<Record<string, {
    configs: Record<string, ReportConfig>;
    reportTypeOptions: Array<{ value: string; label: string }>;
    emailTypeToAudience: Record<string, string>;
  }>>({});

  const lastFetchedAudiencesRef = useRef<string | null>(null);
  const reportTypeRef = useRef(reportType);
  useEffect(() => { reportTypeRef.current = reportType; }, [reportType]);

  const allReportTypeOptions = ALLOWED_REPORT_TYPES.map(type => ({
    value: type,
    label: REPORT_TYPE_DISPLAY_LABELS[type]
  }));

  const allEmailTypeToAudience = (() => {
    const map: Record<string, string> = {};
    Object.values(audienceDataStore).forEach(audienceData => {
      Object.entries(audienceData.emailTypeToAudience).forEach(([emailType, audience]) => {
        map[emailType] = audience; // Always use the last one (from the latest fetch)
      });
    });
  
    return map;
  })();

   const config = appliedReportType ? (() => {
  const audience = allEmailTypeToAudience[appliedReportType];
  // console.log('🎯 config lookup:', { appliedReportType, audience, audienceDataStore });
  if (audience && audienceDataStore[audience]) {
    const result = audienceDataStore[audience].configs[appliedReportType];
    // console.log('✅ config result:', result);
    return result;
  }
  return null;
})() : null;

const fetchConfigs = useCallback(async (selectedAudiences?: string[], selectedEmailTypes?: string[]) => {
    const defaultAllowedAudiences = ['testing', 'employee', 'chairman'];
    const audiencesToFetch = selectedAudiences || defaultAllowedAudiences;

    let newAudienceData: Record<string, {
      configs: Record<string, ReportConfig>;
      reportTypeOptions: Array<{ value: string; label: string }>;
      emailTypeToAudience: Record<string, string>;
    }> | null = null;

    setIsLoading(true);
    try {
      const quotedAudiences = audiencesToFetch.map(a => `'${a}'`).join(', ');
      let q = `audience in (${quotedAudiences})`;
      if (selectedEmailTypes && selectedEmailTypes.length > 0) {
        const quotedEmailTypes = selectedEmailTypes.map(e => `'${e}'`).join(', ');
        q += ` and email_type in (${quotedEmailTypes})`;
      }

      const response = await apiClient.get('/api/dailyemailnotificationusers', {
        params: { limit: 100, skip: 0, q }
      });
      const data = response.data?.data || [];
      // console.log('🔍 fetchConfigs API response:', { selectedAudiences, selectedEmailTypes, data });
      newAudienceData = {};
      audiencesToFetch.forEach(a => {
        newAudienceData![a] = { configs: {}, reportTypeOptions: [], emailTypeToAudience: {} };
      });

      // Process all items, using the last one for each email_type
      const emailTypeMap = new Map<string, EmailNotificationConfig>();
      data.forEach((item: EmailNotificationConfig) => {
        if (newAudienceData![item.audience]) {
          emailTypeMap.set(item.email_type, item);
        }
      });

      // Build the new audience data from the map
      emailTypeMap.forEach((item) => {
        const audience = item.audience;
        if (newAudienceData![audience]) {
          newAudienceData![audience].reportTypeOptions.push({ value: item.email_type, label: item.email_type });
          newAudienceData![audience].emailTypeToAudience[item.email_type] = audience;
          newAudienceData![audience].configs[item.email_type] = {
            subject: item.subject,
            body: '',
            emails: {
              to: item.to_recipients || [],
              cc: item.cc_recipients || [],
              bcc: item.bcc_recipients || []
            },
            name: item.name,
            description: item.description,
            enabled: item.enabled
          };
        }
      });
    } catch (err) {
      // console.error('Error fetching email configs:', err);
      toast.error("Failed to load email configurations");
    } finally {
      setIsLoading(false);
    }

    if (newAudienceData) {
      // If we're fetching specific audiences, replace only those audiences
      // Otherwise, replace all data
      setAudienceDataStore(prev => {
        if (selectedAudiences) {
          // Replace only the selected audiences
          const updated = { ...prev };
          Object.entries(newAudienceData!).forEach(([audience, data]) => {
            updated[audience] = data;
          });
          return updated;
        } else {
          // Replace all data
          return newAudienceData!;
        }
      });

      if (!reportTypeRef.current) {
        const allOptions: Array<{ value: string; label: string }> = [];
        const seen = new Set<string>();
        Object.values(newAudienceData).forEach(audienceData => {
          audienceData.reportTypeOptions.forEach(opt => {
            if (!seen.has(opt.value)) { seen.add(opt.value); allOptions.push(opt); }
          });
        });
        if (allOptions.length > 0) {
          setReportType(allOptions[0].value);
          setAppliedReportType(allOptions[0].value); // populate ComposeRules on initial load
        }
      }
    }

    if (!selectedAudiences) setInitialLoadComplete(true);
  }, []);

const handleReportTypeChange = (val: string) => {
  setReportType(val);
};

const handleEnvironmentChange = (val: string) => {
  setEnvironment(val);
};

  const handleApplyClick = async () => {
  if (!environment) return;
  // console.log('🚀 handleApplyClick called:', { environment, reportType });
  setAppliedReportType(null);
  // Clear the specific audience data before fetching fresh
  setAudienceDataStore(prev => {
    const updated = { ...prev };
    delete updated[environment];
    return updated;
  });
  await fetchConfigs([environment], reportType ? [reportType] : undefined);
  // console.log('✅ fetchConfigs complete, setting appliedReportType to:', reportType);
  setAppliedReportType(reportType);
};

  useEffect(() => {
    setAudienceDataStore({});
    setReportType(null);
    setEnvironment(null);
    setInitialLoadComplete(false);
    lastFetchedAudiencesRef.current = null;
  }, []);

  useEffect(() => {
    if (lastFetchedAudiencesRef.current !== 'all') {
      lastFetchedAudiencesRef.current = 'all';
      fetchConfigs(['testing', 'employee', 'chairman']);
    }
  }, []);

// useEffect(() => {
//   apiClient.post('/api/dailyemailnotificationusers/get_email_audience', {})
//     .then(res => {
//       const audiences: string[] = res.data?.data ?? res.data ?? [];
//       setEnvironmentOptions(audiences);
//     })
//     .catch(() => toast.error("Failed to load environment options"));
// }, []);

const ENVIRONMENT_VALUE_MAP: Record<string, string> = {
  'Scheduled Report': 'chairman',
  'Test Report': 'employee',
  'Dev Testing': 'testing',
};

useEffect(() => {
  apiClient.post('/api/dailyemailnotificationusers/get_email_audience', {})
    .then(res => {
      const raw: string[] = res.data?.data ?? res.data ?? [];
      const normalized = raw.map(opt => ENVIRONMENT_VALUE_MAP[opt] ?? opt);
      setEnvironmentOptions(normalized);
    })
    .catch(() => toast.error("Failed to load environment options"));
}, []);

  return (
  <div className="bg-slate-50 p-2">
    <div className="mx-auto grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-2">

      {/* ── Left: General Settings ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 h-fit space-y-4">
        <div className="flex items-center gap-2 px-4 py-3 -mx-4 -mt-4 mb-4 border-b border-slate-100 bg-indigo-50/40">
          <Mail size={15} className="text-indigo-500" />
          <h2 className="text-sm font-semibold text-slate-900">Email Configuration</h2>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10">
            <div className="w-8 h-8 rounded-full border-[3px] border-slate-200 border-t-indigo-500 animate-spin" />
            <p className="text-xs text-slate-400 font-medium">Loading...</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Report Type</label>
              <Select value={reportType || ''} onValueChange={handleReportTypeChange}>
                <SelectTrigger className="w-full h-10 border-slate-200">
                  <SelectValue placeholder="Select Report Type" />
                </SelectTrigger>
                <SelectContent>
                  {allReportTypeOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Environment</label>
              <Select value={environment || ''} onValueChange={handleEnvironmentChange}>
                <SelectTrigger className="w-full h-10 border-slate-200">
                  <SelectValue placeholder="Select Environment" />
                </SelectTrigger>
                <SelectContent>
                  {environmentOptions.map(opt => (
                    <SelectItem key={opt} value={opt}>
                      {ENVIRONMENT_DISPLAY_LABELS[opt] ?? opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          {/* <button
           type="button"
              onClick={handleApplyClick}
              disabled={!environment}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition shadow-sm flex items-center justify-center gap-4"
        >
          Submit
        </button> */}

<button
  type="button"
  onClick={handleApplyClick}
  disabled={!environment}
  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-1 rounded-lg transition shadow-sm flex items-center justify-center gap-4 mx-auto"
>
  Submit
</button>

          </>
        )}
      </div>

      <ComposeRules
  isLoading={isLoading}
  reportType={appliedReportType}
  config={config}
  audienceDataStore={audienceDataStore}
  allEmailTypeToAudience={allEmailTypeToAudience}
  setAudienceDataStore={setAudienceDataStore}
  fetchConfigs={fetchConfigs}
/>
    </div>
  </div>
);
};

export default DistributionSetupDashboard;