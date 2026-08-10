import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '../../@/components/ui/alert';
import { useCallback, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackMessage?: string; // Add a prop for custom fallback messages
}

interface FallbackProps {
  error: Error | null;
  resetError: () => void;
  fallbackMessage: string; // Add this prop to pass the message dynamically
}

const ChartErrorFallback: React.FC<FallbackProps> = ({ error, resetError, fallbackMessage }) => { 
  return (
    <div className="h-full w-full flex items-center justify-center p-4">
      <Alert variant="destructive" className="w-full max-w-md">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p className="font-medium">{fallbackMessage || 'Unable to load chart'}</p>
            <p className="text-sm text-gray-500">
              {error?.message || 'An unexpected error occurred while loading the chart.'}
            </p>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
};

const ChartErrorBoundary: React.FC<ErrorBoundaryProps> = ({ children, fallbackMessage = 'Unable to load ' }) => {
  const [error, setError] = useState<Error | null>(null);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  const onError = (error: Error) => {
    setError(error);
    // console.error('Chart Error:', error);
  };

  if (error) {
    return <ChartErrorFallback error={error} resetError={resetError} fallbackMessage={fallbackMessage} />;
  }

  return (
    <ErrorBoundary
      fallback={<ChartErrorFallback error={error} resetError={resetError} fallbackMessage={fallbackMessage} />}
      onError={onError}
    >
      {children}
    </ErrorBoundary>
  );
};

export default ChartErrorBoundary;
