import React, { useEffect, useState, useRef, KeyboardEvent } from 'react';
import { Eye, EyeOff, Loader2, X, AlertCircle, Info } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/@/components/ui/sheet';
import { Button } from '@/@/components/ui/button';
import { Input } from '@/@/components/ui/input';
import { Label } from '@/@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/@/lib/utils';
import type { DbType, PlantFormValues, PlantRecord } from '../types';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

const validateEmail = (email: string): string | null => {
  if (!email) return null;
  if (!EMAIL_REGEX.test(email)) return 'Invalid email address';
  return null;
};

interface EmailChipRowProps {
  label: string;
  labelStyle: string;
  emails: string[];
  onAdd: (email: string) => void;
  onRemove: (email: string) => void;
}

const EmailChipRow: React.FC<EmailChipRowProps> = ({ label, labelStyle, emails, onAdd, onRemove }) => {
  const [inputVal, setInputVal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const trimmed = inputVal.trim();
    if (!trimmed) { setError(null); return; }
    const validationError = validateEmail(trimmed);
    if (validationError) { setError(validationError); return; }
    onAdd(trimmed);
    setInputVal('');
    setError(null);
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { setInputVal(''); setError(null); }
    if (e.key === 'Backspace' && inputVal === '' && emails.length > 0) {
      setPendingDelete(emails[emails.length - 1]);
    }
  };

  return (
    <>
      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
          onClick={() => setPendingDelete(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-[420px] mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="h-1 w-full bg-gradient-to-r from-blue-400 to-blue-500" />
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 border border-blue-100 mx-auto mb-4">
                <X size={20} className="text-blue-500" />
              </div>
              <h3 className="text-center text-base font-semibold text-slate-800 mb-1">Remove Recipient?</h3>
              <p className="text-center text-sm text-slate-500 mb-1">
                You're about to remove this address from {label}:
              </p>
              <div className="flex justify-center mb-5">
                <span className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium rounded-full px-3 py-1.5 max-w-full">
                  {pendingDelete}
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setPendingDelete(null)} className="flex-1 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
                  Cancel
                </button>
                <button onClick={() => { onRemove(pendingDelete); setPendingDelete(null); }} className="flex-1 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition shadow-sm">
                  Yes, Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 bg-white transition
          ${error ? 'border-red-300 ring-1 ring-red-100' : 'border-slate-200 hover:border-indigo-200'}`}
        >
          <div className={`shrink-0 mt-0.5 flex items-center justify-center w-11 h-7 rounded-md text-xs font-bold tracking-wide ${labelStyle}`}>
            {label}
          </div>
          <div className="flex-1 flex flex-wrap gap-1.5 max-h-[110px] overflow-y-auto pr-1"
            onClick={() => inputRef.current?.focus()}
          >
            {emails.map(email => (
              <span key={email} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-xs rounded-full px-2.5 py-1 font-medium border border-slate-200">
                {email}
                <button onClick={e => { e.stopPropagation(); setPendingDelete(email); }}
                  className="text-slate-400 hover:text-red-500 transition ml-0.5" title="Remove">
                  <X size={11} />
                </button>
              </span>
            ))}
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
          </div>
        </div>
        {error && (
          <div className="flex items-center gap-1.5 px-1 text-xs text-red-500">
            <AlertCircle size={11} className="shrink-0" />{error}
          </div>
        )}
        {!error && inputVal && (
          <div className="flex items-center gap-1.5 px-1 text-xs text-slate-400">
            <Info size={11} className="shrink-0" />
            Press Enter or comma to add · e.g. name@domain.com
          </div>
        )}
      </div>
    </>
  );
};

interface PlantFormDrawerProps {
  open: boolean;
  mode: 'add' | 'edit';
  plant?: PlantRecord | null;
  onOpenChange: (open: boolean) => void;
  onSave: (values: PlantFormValues) => void | Promise<void>;
  onTestConnection: (values: PlantFormValues) => boolean | Promise<boolean>;
}

const emptyForm: PlantFormValues = {
  sapErpId: '',
  plantName: '',
  ipAddress: '',
  portNumber: '',
  username: '',
  password: '',
  dbType: 'PostgreSQL',
  dbName: '',
  dbTypeIconUrl:"PostgreSQL",
  mail_recipients: [],
};

const SHEET_CLOSE_BTN =
  '[&>button]:right-2 [&>button]:top-2 [&>button]:left-auto [&>button]:h-7 [&>button]:w-7 [&>button]:rounded-md [&>button]:bg-white [&>button]:p-0 [&>button]:shadow-sm [&>button]:inline-flex [&>button]:items-center [&>button]:justify-center [&>button]:border [&>button]:border-gray-200 [&>button]:outline-none [&>button]:ring-0 [&>button]:focus:outline-none [&>button]:focus:ring-0 [&>button_svg]:h-4 [&>button_svg]:w-4';

const compactInput = 'h-8 text-sm';

const PlantFormDrawer: React.FC<PlantFormDrawerProps> = ({
  open,
  mode,
  plant,
  onOpenChange,
  onSave,
  onTestConnection,
}) => {
  const [form, setForm] = useState<PlantFormValues>(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestPassed, setConnectionTestPassed] = useState(false);

  useEffect(() => {
    if (open && mode === 'edit' && plant) {
      setForm({
        sapErpId: plant.sapErpId,
        plantName: plant.plantName,
        ipAddress: plant.ipAddress,
        portNumber: plant.portNumber,
        username: plant.username,
        password: plant.password,
        dbType: plant.dbType,
        dbName: plant.dbName,
        passwordEdited: false,
        dbTypeIconUrl:plant.dbTypeIconUrl,
        mail_recipients: plant.mail_recipients || [],
      });
    } else if (open && mode === 'add') {
      setForm({ ...emptyForm, passwordEdited: true });
    }
    if (!open) setShowPassword(false);
    setConnectionTestPassed(false);
    setTestingConnection(false);
  }, [open, mode, plant]);

  const updateField = (field: keyof PlantFormValues, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'password' ? { passwordEdited: true } : {}),
    }));
    setConnectionTestPassed(false);
  };

  const handleLocationIdChange = (value: string) => {
    updateField('sapErpId', value.replace(/\D/g, ''));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sapErpId.trim()) {
      toast.error('Location ID is required.');
      return;
    }
    if (!/^\d+$/.test(form.sapErpId.trim())) {
      toast.error('Location ID must contain numbers only.');
      return;
    }
    if (!connectionTestPassed) {
      toast.error('Please test the connection successfully before saving.');
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
      onOpenChange(false);
    } catch {
      // Error toast handled by parent
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!form.sapErpId.trim()) {
      toast.error('Location ID is required.');
      return;
    }
    if (!/^\d+$/.test(form.sapErpId.trim())) {
      toast.error('Location ID must contain numbers only.');
      return;
    }

    setTestingConnection(true);
    setConnectionTestPassed(false);
    try {
      const passed = await onTestConnection(form);
      setConnectionTestPassed(passed);
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          'flex h-full w-full flex-col gap-0 border-l border-gray-200 bg-white p-0 shadow-xl sm:max-w-md',
          SHEET_CLOSE_BTN
        )}
      >
        <SheetHeader className="shrink-0 space-y-0 border-b border-gray-200 px-3 py-2 text-left">
          <SheetTitle className="text-base font-semibold text-gray-800">
            {mode === 'add' ? 'Add New Plant' : 'Edit Plant'}
          </SheetTitle>
          <p className="text-xs text-gray-500">
            {mode === 'add'
              ? 'Enter connection details for the new bottling plant.'
              : `Update details for ${plant?.plantName ?? 'plant'}.`}
          </p>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-2">
            <FormSection title="Plant Details">
              <FormField label="Location ID" required htmlFor="sapErpId">
                <Input
                  id="sapErpId"
                  value={form.sapErpId}
                  onChange={(e) => handleLocationIdChange(e.target.value)}
                  placeholder="Enter location ID"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  disabled={mode === 'edit'}
                  className={compactInput}
                />
              </FormField>

              <FormField label="Plant Name" htmlFor="plantName">
                <Input
                  id="plantName"
                  value={form.plantName}
                  onChange={(e) => updateField('plantName', e.target.value)}
                  placeholder="Enter plant name"
                  className={compactInput}
                />
              </FormField>
            </FormSection>
            <FormSection title="Database Details">
              <FormField label="DB Type" htmlFor="dbType">
                <Select
                  value={form.dbType}
                  onValueChange={(value) => updateField('dbType', value as DbType)}
                >
                  <SelectTrigger id="dbType" className={cn(compactInput, 'w-full')}>
                    <SelectValue placeholder="Select DB type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PostgreSQL">PostgreSQL</SelectItem>
                    <SelectItem value="MySQL">MySQL</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="IP Address" htmlFor="ipAddress">
                <Input
                  id="ipAddress"
                  value={form.ipAddress}
                  onChange={(e) => updateField('ipAddress', e.target.value)}
                  placeholder="e.g. 192.168.1.100"
                  className={compactInput}
                />
              </FormField>

              <FormField label="Port Number" htmlFor="portNumber">
                <Input
                  id="portNumber"
                  value={form.portNumber}
                  onChange={(e) => updateField('portNumber', e.target.value)}
                  placeholder="e.g. 5432"
                  inputMode="numeric"
                  className={compactInput}
                />
              </FormField>

              <FormField label="Username" htmlFor="username">
                <Input
                  id="username"
                  value={form.username}
                  onChange={(e) => updateField('username', e.target.value)}
                  placeholder="Enter username"
                  autoComplete="off"
                  className={compactInput}
                />
              </FormField>

              <FormField label="Password" htmlFor="password">
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => updateField('password', e.target.value)}
                    placeholder="Enter password"
                    className={cn(compactInput, 'pr-9')}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </FormField>

              <FormField label="DB Name" htmlFor="dbName">
                <Input
                  id="dbName"
                  value={form.dbName}
                  onChange={(e) => updateField('dbName', e.target.value)}
                  placeholder="Enter database name"
                  className={compactInput}
                />
              </FormField>
                 <FormSection title="Notification Settings">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-700">Mail Recipients</Label>
                <EmailChipRow
                  label="TO"
                  labelStyle="bg-indigo-50 text-indigo-600"
                  emails={form.mail_recipients || []}
                  onAdd={(email) => setForm(prev => ({ ...prev, mail_recipients: [...(prev.mail_recipients || []), email] }))}
                  onRemove={(email) => setForm(prev => ({ ...prev, mail_recipients: (prev.mail_recipients || []).filter(e => e !== email) }))}
                />
              </div>
            </FormSection>

            </FormSection>
          </div>

          <div className="shrink-0 border-t border-gray-200 px-3 py-2">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-8 flex-1 text-xs text-gray-700"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant={connectionTestPassed ? 'outline' : 'default'}
                className={cn(
                  'h-8 flex-1 text-xs',
                  connectionTestPassed
                    ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                )}
                onClick={handleTestConnection}
                disabled={saving || testingConnection}
              >
                {testingConnection && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {testingConnection
                  ? 'Testing...'
                  : connectionTestPassed
                    ? 'Tested'
                    : 'Test Connection'}
              </Button>
              <Button
                type="submit"
                className="h-8 flex-1 bg-blue-500 text-xs text-white hover:bg-blue-600"
                disabled={saving || testingConnection || !connectionTestPassed}
              >
                {saving ? 'Saving...' : mode === 'add' ? 'Create Plant' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="border-b border-gray-100 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-600">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function FormField({
  label,
  required,
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={htmlFor} className="text-xs font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </Label>
      {children}
    </div>
  );
}

export default PlantFormDrawer;
