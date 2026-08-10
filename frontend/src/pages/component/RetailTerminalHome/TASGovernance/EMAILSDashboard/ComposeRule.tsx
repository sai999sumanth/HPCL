
import React, { useState, useRef, KeyboardEvent } from 'react';
import { Pencil, X, Mail, Check, Info, Lock, AlertCircle, Trash2, FileText } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import { toast } from "sonner";
import { EmailGroup, ReportConfig, getBuForReportType } from './DistributionSetupDashboard';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

const validateEmail = (email: string): string | null => {
  if (!email) return null;
  if (!EMAIL_REGEX.test(email)) return 'Invalid email address';
  return null;
};

const cleanApiMessage = (message: string): string => {
  return message.split(';')[0].trim();
};

const uniqueEmails = (emails?: string[]) =>
  [...new Set((emails ?? []).map((e) => e.trim()).filter(Boolean))];

const formatEmailSnippet = (emails: string[]) => {
  if (emails.length === 0) return '';
  if (emails.length === 1) return emails[0];
  if (emails.length === 2) return emails.join(', ');
  return `${emails[0]}, ${emails[1]} +${emails.length - 2} more`;
};

const RECIPIENT_BUCKETS = [
  { label: 'To', updatedKey: 'Updated_to_recipients', existsKey: 'Already_exists_emails' },
  { label: 'CC', updatedKey: 'Updated_cc_recipients', existsKey: 'Already_exists_cc_emails' },
  { label: 'BCC', updatedKey: 'Updated_bcc_recipients', existsKey: 'Already_exists_bcc_emails' },
] as const;

const getResultField = (
  root: Record<string, unknown>,
  nested: Record<string, unknown>,
  key: string
) => (root[key] ?? nested[key]) as string[] | undefined;

const showRecipientResultToasts = (payload: unknown) => {
  const root = (payload as Record<string, unknown>) ?? {};
  const nested = (root.data as Record<string, unknown>) ?? {};
  let anyToast = false;

  for (const { label, updatedKey, existsKey } of RECIPIENT_BUCKETS) {
    const added = uniqueEmails(getResultField(root, nested, updatedKey));
    const alreadyExists = uniqueEmails(getResultField(root, nested, existsKey));

    if (added.length > 0) {
      anyToast = true;
      toast.success(
        added.length === 1
          ? `${added[0]} added to ${label} recipients.`
          : `${added.length} added to ${label} recipients — ${formatEmailSnippet(added)}.`
      );
    }

    if (alreadyExists.length > 0) {
      anyToast = true;
      toast.info(
        alreadyExists.length === 1
          ? `${alreadyExists[0]} already exists in ${label} recipients.`
          : `${alreadyExists.length} already exist in ${label} recipients — ${formatEmailSnippet(alreadyExists)}.`
      );
    }
  }

  if (!anyToast) {
    const message = (root.message ?? nested.message) as string | undefined;
    toast.success(cleanApiMessage(message || 'Changes saved successfully'));
  }
};

interface DeleteConfirmDialogProps {
  email: string;
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const LoadingSpinner = () => (
  <div className="flex flex-col items-center justify-center gap-3 min-h-[300px]">
    <div className="w-8 h-8 rounded-full border-[3px] border-slate-200 border-t-indigo-500 animate-spin" />
    <p className="text-xs text-slate-400 font-medium">Loading...</p>
  </div>
);

const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({ email, label, onConfirm, onCancel }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
    onClick={onCancel}
  >
    <div
      className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-[420px] mx-4 overflow-hidden"
      onClick={e => e.stopPropagation()}
    >
      <div className="h-1 w-full bg-gradient-to-r from-blue-400 to-blue-500" />
      <div className="p-6">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 border border-blue-100 mx-auto mb-4">
          <Trash2 size={20} className="text-blue-500" />
        </div>
        <h3 className="text-center text-base font-semibold text-slate-800 mb-1">Remove Recipient?</h3>
        <p className="text-center text-sm text-slate-500 mb-1">
          You're about to remove this address from{' '}
          <span className="font-semibold text-slate-700">{label}</span>:
        </p>
        <div className="flex justify-center mb-5">
          <span className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium rounded-full px-3 py-1.5 max-w-full">
            <Mail size={11} className="text-slate-400 shrink-0" />
            <span className="truncate">{email}</span>
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition shadow-sm">
            Yes, Remove
          </button>
        </div>
      </div>
    </div>
  </div>
);

interface EmailChipRowProps {
  label: string;
  labelStyle: string;
  emails: string[];
  unsavedEmails?: string[];
  onAdd: (email: string) => void;
  onRemove: (email: string) => void;
  editMode: boolean;
}

const EmailChipRow: React.FC<EmailChipRowProps> = ({ label, labelStyle, emails, unsavedEmails = [], onAdd, onRemove, editMode }) => {
  const [inputVal, setInputVal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const parts = inputVal.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) { setError(null); return; }

    const validEmails: string[] = [];
    for (const part of parts) {
      const validationError = validateEmail(part);
      if (validationError) {
        setError(validationError);
        return;
      }
      validEmails.push(part);
    }

    validEmails.forEach(onAdd);
    setInputVal('');
    setError(null);
  };

  const requestRemove = (email: string) => {
    if (unsavedEmails.includes(email)) {
      onRemove(email);
    } else {
      setPendingDelete(email);
    }
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { setInputVal(''); setError(null); }
    if (e.key === 'Backspace' && inputVal === '' && emails.length > 0 && editMode) {
      requestRemove(emails[emails.length - 1]);
    }
  };

  return (
    <>
      {pendingDelete && (
        <DeleteConfirmDialog
          email={pendingDelete}
          label={label}
          onConfirm={() => { onRemove(pendingDelete); setPendingDelete(null); }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
      <div className="flex flex-col gap-1">
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 bg-white transition
          ${error ? 'border-red-300 ring-1 ring-red-100' : 'border-slate-200 hover:border-indigo-200'}`}
        >
          <div className={`shrink-0 mt-0.5 flex items-center justify-center w-11 h-7 rounded-md text-xs font-bold tracking-wide ${labelStyle}`}>
            {label}
          </div>
          <div className="flex-1 flex flex-wrap gap-1.5 max-h-[110px] overflow-y-auto pr-1"
            onClick={() => editMode && inputRef.current?.focus()}
          >
            {emails.map(email => (
              <span key={email} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-xs rounded-full px-2.5 py-1 font-medium border border-slate-200">
                {email}
                {editMode && (
                  <button onClick={e => { e.stopPropagation(); requestRemove(email); }}
                    className="text-slate-400 hover:text-red-500 transition ml-0.5" title="Remove">
                    <X size={11} />
                  </button>
                )}
              </span>
            ))}
            {editMode && (
              <input
                ref={inputRef}
                type="email"
                value={inputVal}
                onChange={e => { setInputVal(e.target.value); if (error) setError(null); }}
                onKeyDown={handleKey}
                onBlur={commit}
                placeholder="Add email..."
                className="text-xs text-slate-500 placeholder-slate-400 outline-none bg-transparent min-w-[140px] py-1"
              />
            )}
          </div>
        </div>
        {error && (
          <div className="flex items-center gap-1.5 px-1 text-xs text-blue-500">
            <AlertCircle size={11} className="shrink-0" />{error}
          </div>
        )}
        {editMode && !error && inputVal && (
          <div className="flex items-center gap-1.5 px-1 text-xs text-slate-400">
            <Info size={11} className="shrink-0" />
            Press Enter or comma to add · e.g. name@domain.com
          </div>
        )}
      </div>
    </>
  );
};

interface ComposeRulesProps {
    isLoading: boolean;
  reportType: string | null;
  config: ReportConfig | null | undefined;
  audienceDataStore: Record<string, {
    configs: Record<string, ReportConfig>;
    reportTypeOptions: Array<{ value: string; label: string }>;
    emailTypeToAudience: Record<string, string>;
  }>;
  allEmailTypeToAudience: Record<string, string>;
  setAudienceDataStore: React.Dispatch<React.SetStateAction<Record<string, {
    configs: Record<string, ReportConfig>;
    reportTypeOptions: Array<{ value: string; label: string }>;
    emailTypeToAudience: Record<string, string>;
  }>>>;
  fetchConfigs: (selectedAudiences?: string[], selectedEmailTypes?: string[]) => Promise<void>;
}

export const ComposeRules: React.FC<ComposeRulesProps> = ({
    isLoading, 
  reportType,
  config,
  audienceDataStore,
  allEmailTypeToAudience,
  setAudienceDataStore,
  fetchConfigs,
}) => {
  const [editMode, setEditMode] = useState(false);
  const [pendingSubject, setPendingSubject] = useState<string | null>(null);
  const [pendingAdditions, setPendingAdditions] = useState<{ kind: keyof EmailGroup; email: string }[]>([]);
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [showResponse, setShowResponse] = useState(false);

  // Clear response when report type changes
  React.useEffect(() => {
    setApiResponse(null);
    setShowResponse(false);
  }, [reportType]);

  const resetPending = () => {
    setPendingAdditions([]);
    setPendingSubject(null);
    setEditMode(false);
  };

  const addEmail = (kind: keyof EmailGroup, email: string) => {
    if (!reportType) return;
    const audience = allEmailTypeToAudience[reportType];
    if (!audience || !audienceDataStore[audience]) return;

    setAudienceDataStore(prev => {
      const audienceData = prev[audience];
      if (!audienceData) return prev;
      const cfg = audienceData.configs[reportType];
      if (!cfg) return prev;
      return {
        ...prev,
        [audience]: {
          ...audienceData,
          configs: {
            ...audienceData.configs,
            [reportType]: {
              ...cfg,
              emails: { ...cfg.emails, [kind]: [...cfg.emails[kind], email] }
            }
          }
        }
      };
    });

    setPendingAdditions(prev => [...prev, { kind, email }]);
  };

const removeEmail = async (kind: keyof EmailGroup, email: string) => {
  if (!reportType) return;
  const audience = allEmailTypeToAudience[reportType];
  if (!audience || !audienceDataStore[audience]) return;
  const cfg = audienceDataStore[audience].configs[reportType];
  if (!cfg) return;

  const isUnsaved = pendingAdditions.some(p => p.kind === kind && p.email === email);
  if (isUnsaved) {
    setPendingAdditions(prev => prev.filter(p => !(p.kind === kind && p.email === email)));
    setAudienceDataStore(prev => {
      const audienceData = prev[audience];
      if (!audienceData) return prev;
      const existingCfg = audienceData.configs[reportType];
      if (!existingCfg) return prev;
      return {
        ...prev,
        [audience]: {
          ...audienceData,
          configs: {
            ...audienceData.configs,
            [reportType]: {
              ...existingCfg,
              emails: {
                ...existingCfg.emails,
                [kind]: existingCfg.emails[kind].filter(e => e !== email),
              },
            },
          },
        },
      };
    });
    return;
  }

  try {
    const response = await apiClient.post('/api/dailyemailnotificationusers/add_recipients', {
      email_type: reportType,
      bu: getBuForReportType(reportType),
      name: cfg.name,
      subject: cfg.subject,
      description: cfg.description || "",
      enabled: cfg.enabled,
      audience,
      to_recipients: kind === "to" ? [email] : [],
      cc_recipients: kind === "cc" ? [email] : [],
      bcc_recipients: kind === "bcc" ? [email] : [],
      action: "delete"
    });
    showRecipientResultToasts(response.data ?? {});
    setApiResponse(response.data);
    setShowResponse(true);

    // Refresh the data to show updated values
    setAudienceDataStore(prev => {
      const updated = { ...prev };
      if (updated[audience]) {
        delete updated[audience].configs[reportType];
      }
      return updated;
    });
    await fetchConfigs([audience], [reportType]);
  } catch (err) {
    setApiResponse(err);
    setShowResponse(true);
    console.error('Error removing email:', err);
    toast.error("Failed to remove email");
  }
};

const handleSave = async () => {
  if (pendingAdditions.length === 0 && pendingSubject === null) {
    setEditMode(false);
    return;
  }

  const audience = reportType ? allEmailTypeToAudience[reportType] : null;
  const cfg = audience && audienceDataStore[audience]?.configs[reportType!];

  if (!reportType || !audience || !cfg) {
    setEditMode(false);
    return;
  }

  const patchSubject = (newSubject: string) => {
    setAudienceDataStore(prev => {
      const audienceData = prev[audience];
      const existingCfg = audienceData?.configs[reportType];
      if (!audienceData || !existingCfg) return prev;
      return {
        ...prev,
        [audience]: {
          ...audienceData,
          configs: {
            ...audienceData.configs,
            [reportType]: { ...existingCfg, subject: newSubject }
          }
        }
      };
    });
  };

  if (pendingAdditions.length === 0 && pendingSubject !== null) {
    try {
      const res = await apiClient.post('/api/dailyemailnotificationusers/add_recipients', {
        email_type: reportType,
        bu: getBuForReportType(reportType),
        name: cfg.name,
        subject: pendingSubject,
        description: cfg.description || "",
        enabled: cfg.enabled,
        audience,
        to_recipients: [],
        cc_recipients: [],
        bcc_recipients: [],
        action: "add"
      });
      showRecipientResultToasts(res.data ?? {});
      setApiResponse(res.data);
      setShowResponse(true);
      
      // Clear pending first
      setPendingSubject(null);
      
      // Refresh the data to show updated values
      setAudienceDataStore(prev => {
        const updated = { ...prev };
        if (updated[audience]) {
          delete updated[audience].configs[reportType];
        }
        return updated;
      });
      await fetchConfigs([audience], [reportType]);
    } catch (err) {
      setApiResponse(err);
      setShowResponse(true);
      toast.error("Failed to update subject");
    }
    setEditMode(false);
    return;
  }

  try {
    const toRecipients = pendingAdditions.filter(p => p.kind === 'to').map(p => p.email);
    const ccRecipients = pendingAdditions.filter(p => p.kind === 'cc').map(p => p.email);
    const bccRecipients = pendingAdditions.filter(p => p.kind === 'bcc').map(p => p.email);

    const response = await apiClient.post('/api/dailyemailnotificationusers/add_recipients', {
      email_type: reportType,
      bu: getBuForReportType(reportType),
      name: cfg.name,
      subject: pendingSubject !== null ? pendingSubject : cfg.subject,
      description: cfg.description || "",
      enabled: cfg.enabled,
      audience,
      to_recipients: toRecipients,
      cc_recipients: ccRecipients,
      bcc_recipients: bccRecipients,
      action: "add"
    });
    showRecipientResultToasts(response.data ?? {});
    setApiResponse(response.data);
    setShowResponse(true);

    // Clear pending first
    setPendingAdditions([]);
    setPendingSubject(null);
    
    // Refresh the data to show updated values
    setAudienceDataStore(prev => {
      const updated = { ...prev };
      if (updated[audience]) {
        delete updated[audience].configs[reportType];
      }
      return updated;
    });
    await fetchConfigs([audience], [reportType]);
  } catch (err) {
    setApiResponse(err);
    setShowResponse(true);
    console.error('Error saving additions:', err);
    toast.error("Failed to save changes");
  }

  setEditMode(false);
};
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-indigo-50/40">
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-indigo-500" />
          <h2 className="text-sm font-semibold text-slate-900">Compose Rules</h2>
        </div>
        <button
        //   onClick={() => { setEditMode(v => !v); if (editMode) resetPending(); }}
        onClick={() => setEditMode(v => !v)}
          title={editMode ? 'Done editing' : 'Edit'}
          className={`flex items-center justify-center w-7 h-7 rounded-md border transition
            ${editMode
              ? 'bg-emerald-100 border-emerald-300 text-emerald-600'
              : 'border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50'
            }`}
        >
          {editMode ? <Check size={13} /> : <Pencil size={13} className="text-black" />}
        </button>
      </div>

      <div className="p-4 flex-1 overflow-y-auto space-y-3">
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <>
        {reportType && config ? (
          <>
            <div className="flex items-center gap-2 mb-1">
              <span className="shrink-0 text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-14">Subject</span>
              <input
                type="text"
                value={pendingSubject !== null ? pendingSubject : config.subject}
                readOnly={!editMode}
                onChange={e => editMode && setPendingSubject(e.target.value)}
                className={`flex-1 rounded-md px-2 py-1.5 text-sm font-medium outline-none transition
                  ${editMode
                    ? 'border border-indigo-300 ring-1 ring-indigo-100 bg-white text-slate-900 cursor-text'
                    : 'border border-slate-200 bg-slate-50 text-slate-600 cursor-default'
                  }`}
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Configured Recipients</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            <EmailChipRow label="TO" labelStyle="bg-indigo-50 text-indigo-600"
              emails={config.emails.to}
              unsavedEmails={pendingAdditions.filter(p => p.kind === 'to').map(p => p.email)}
              onAdd={e => addEmail('to', e)} onRemove={e => removeEmail('to', e)} editMode={editMode} />
            <EmailChipRow label="CC" labelStyle="bg-purple-50 text-purple-600"
              emails={config.emails.cc}
              unsavedEmails={pendingAdditions.filter(p => p.kind === 'cc').map(p => p.email)}
              onAdd={e => addEmail('cc', e)} onRemove={e => removeEmail('cc', e)} editMode={editMode} />
            <EmailChipRow label="BCC" labelStyle="bg-slate-100 text-slate-600"
              emails={config.emails.bcc}
              unsavedEmails={pendingAdditions.filter(p => p.kind === 'bcc').map(p => p.email)}
              onAdd={e => addEmail('bcc', e)} onRemove={e => removeEmail('bcc', e)} editMode={editMode} />

            {!editMode && (
              <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                <Lock size={12} className="shrink-0" />
                Click the edit button above to edit recipients and subject
              </div>
            )}
          </>
        ) : reportType && !config ? (
          <>
            <div className="flex items-center gap-2 mb-1">
              <span className="shrink-0 text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-14">Subject</span>
              <input type="text" value="" readOnly disabled
                className="flex-1 rounded-md px-2 py-1.5 text-sm font-medium outline-none transition border border-slate-200 bg-slate-50 text-slate-600 cursor-default" />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Configured Recipients</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>
            {(['TO', 'CC', 'BCC'] as const).map(l => (
              <EmailChipRow key={l} label={l}
                labelStyle={l === 'TO' ? 'bg-indigo-50 text-indigo-600' : l === 'CC' ? 'bg-purple-50 text-purple-600' : 'bg-slate-100 text-slate-600'}
                emails={[]} onAdd={() => {}} onRemove={() => {}} editMode={false} />
            ))}
          </>
        ) : (
          <div className="flex items-center justify-center min-h-[300px] text-slate-500">
            Select a report type to view configuration
          </div>
        )}
        </>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 px-5 py-2 border-t border-slate-100 bg-slate-50/60">
        <button
          onClick={handleSave}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition shadow-sm"
        >
          Save Changes
        </button>
      </div>

    </div>
  );
};