import { useState, useEffect } from 'react';

interface DateOptions {
  format?: 'DD-MMM-YYYY' | 'YYYY-MM-DD' | 'MMM DD, YYYY';
  locale?: string;
}

const useCurrentDate = (options: DateOptions = {}) => {
  const { 
    format = 'DD-MMM-YYYY',
    locale = 'en-GB' 
  } = options;

  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  useEffect(() => {
    const updateDate = () => {
      setCurrentDate(new Date());
    };

    // Calculate time until next midnight
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timeUntilMidnight = tomorrow.getTime() - now.getTime();

    // Initial timeout to update at midnight
    const timeout = setTimeout(updateDate, timeUntilMidnight);

    // Daily interval after first midnight
    const interval = setInterval(updateDate, 24 * 60 * 60 * 1000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  const formatDate = (date: Date): string => {
    switch (format) {
      case 'DD-MMM-YYYY': {
        const options: Intl.DateTimeFormatOptions = {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        };
        return date.toLocaleDateString(locale, options).replace(/ /g, '-');
      }
      case 'YYYY-MM-DD': {
        const options: Intl.DateTimeFormatOptions = {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        };
        return date.toLocaleDateString(locale, options).replace(/\//g, '-');
      }
      case 'MMM DD, YYYY': {
        const options: Intl.DateTimeFormatOptions = {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        };
        return date.toLocaleDateString(locale, options);
      }
      default:
        return date.toLocaleDateString(locale);
    }
  };

  return {
    date: currentDate,
    formattedDate: formatDate(currentDate)
  };
};

export default useCurrentDate;