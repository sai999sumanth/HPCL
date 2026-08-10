// const convertUTCDateToLocalDate = (date: Date): Date => {
//   const utcDate = new Date(date.getTime());
//   const timezoneOffset = date.getTimezoneOffset();
//   const localDate = new Date(utcDate.getTime() - (timezoneOffset * 60 * 1000));
//   return localDate;
// };

import { useEffect, useState } from "react";

// export const formatRelativeTime = (updatedAt: string): string => {
//   try {
//     const utcDate = new Date(updatedAt);
    
//     // Check for invalid date
//     if (isNaN(utcDate.getTime())) {
//       return 'Invalid date';
//     }
    
//     const localDate = convertUTCDateToLocalDate(utcDate);
//     const now = new Date();
    
//     const diffInMilliseconds = now.getTime() - localDate.getTime();
    
//     // If the date is in the future or less than a second ago, show "Just now"
//     if (diffInMilliseconds < 1000) {
//       return 'Just now';
//     }
    
//     // If the date is more than a second in the future, show the formatted date
//     if (diffInMilliseconds < 0) {
//       return localDate.toLocaleDateString('en-US', {
//         year: 'numeric',
//         month: 'short',
//         day: 'numeric',
//         hour: '2-digit',
//         minute: '2-digit'
//       });
//     }
    
//     const diffInSeconds = Math.floor(diffInMilliseconds / 1000);
    
//     if (diffInSeconds < 60) {
//       return `${diffInSeconds} ${diffInSeconds === 1 ? 'second' : 'seconds'} ago`;
//     }
    
//     const diffInMinutes = Math.floor(diffInSeconds / 60);
//     if (diffInMinutes < 60) {
//       return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
//     }
    
//     const diffInHours = Math.floor(diffInMinutes / 60);
//     if (diffInHours < 24) {
//       return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
//     }
    
//     const diffInDays = Math.floor(diffInHours / 24);
//     if (diffInDays < 7) {
//       return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
//     }
    
//     if (diffInDays < 30) {
//       const diffInWeeks = Math.floor(diffInDays / 7);
//       return `${diffInWeeks} ${diffInWeeks === 1 ? 'week' : 'weeks'} ago`;
//     }
    
//     const diffInMonths = Math.floor(diffInDays / 30);
//     if (diffInMonths < 12) {
//       return `${diffInMonths} ${diffInMonths === 1 ? 'month' : 'months'} ago`;
//     }
    
//     const diffInYears = Math.floor(diffInDays / 365);
//     return `${diffInYears} ${diffInYears === 1 ? 'year' : 'years'} ago`;
//   } catch (error) {
//     console.error('Error formatting date:', error);
//     return 'Unknown time';
//   }
// };


export const convertUTCDateToLocalDate = (date: Date): Date => {
  const utcDate = new Date(date.getTime());
  const timezoneOffset = date.getTimezoneOffset();
  const localDate = new Date(utcDate.getTime() - (timezoneOffset * 60 * 1000));
  return localDate;
};

export const formatRelativeTime = (updatedAt: string): string => {
  try {
    const utcDate = new Date(updatedAt);
    
    // Check for invalid date
    if (isNaN(utcDate.getTime())) {
      return 'Invalid date';
    }
    
    const localDate = convertUTCDateToLocalDate(utcDate);
    const now = new Date();
    
    const diffInMilliseconds = now.getTime() - localDate.getTime();
    
    // If the date is in the future or less than a second ago, show "Just now"
    if (diffInMilliseconds < 1000) {
      return 'Just now';
    }
    
    // If the date is in the future, show "Future date"
    if (diffInMilliseconds < 0) {
      return 'Future date';
    }
    
    const diffInSeconds = Math.floor(diffInMilliseconds / 1000);
    
    if (diffInSeconds < 60) {
      return `${diffInSeconds} ${diffInSeconds === 1 ? 'second' : 'seconds'} ago`;
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      const remainingMinutes = diffInMinutes % 60;
      return `${diffInHours}h ${remainingMinutes}m ago`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
    }
    
    if (diffInDays < 30) {
      const diffInWeeks = Math.floor(diffInDays / 7);
      return `${diffInWeeks} ${diffInWeeks === 1 ? 'week' : 'weeks'} ago`;
    }
    
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
      return `${diffInMonths} ${diffInMonths === 1 ? 'month' : 'months'} ago`;
    }
    
    const diffInYears = Math.floor(diffInDays / 365);
    return `${diffInYears} ${diffInYears === 1 ? 'year' : 'years'} ago`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Unknown time';
  }
};
export const useRelativeTime = (timestamp: string): string => {
  const [relativeTime, setRelativeTime] = useState<string>(formatRelativeTime(timestamp));

  useEffect(() => {
    const updateTime = () => {
      setRelativeTime(formatRelativeTime(timestamp));
    };

    // Update immediately
    updateTime();

    // Update every minute
    const intervalId = setInterval(updateTime, 60000);

    return () => clearInterval(intervalId);
  }, [timestamp]);

  return relativeTime;
};
export const calculateDuration = (startDate: string, endDate: string): string => {
  try {
    if (!startDate || !endDate) return '-';
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return '-';
    
    // If end date is before start date, return invalid
    if (end < start) return 'Invalid date range';
    
    const diff = end.getTime() - start.getTime();
    
    // Convert to appropriate time units
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      const remainingHours = hours % 24;
      return `${days}d ${remainingHours}h`;
    } else if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    } else if (minutes > 0) {
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${seconds}s`;
    }
  } catch (error) {
    console.error('Error calculating duration:', error);
    return '-';
  }
};

export const formatDateToIST = (utcTimestamp: string): string => {
  try {
    if (!utcTimestamp) return '-';

    // Convert the UTC timestamp to a Date object
    const utcDate = new Date(utcTimestamp);
    
    // Validate the date
    if (isNaN(utcDate.getTime())) return 'Invalid date';

    // Convert UTC to IST by adding 5 hours 30 minutes
    const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
    const istDate = new Date(utcDate.getTime() + istOffset);

    // Format as YYYY-MM-DD, h:mm AM/PM
    const year = istDate.getFullYear();
    const month = String(istDate.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const day = String(istDate.getDate()).padStart(2, '0');
    const hours = istDate.getHours() % 12 || 12; // Convert to 12-hour format
    const minutes = String(istDate.getMinutes()).padStart(2, '0');
    const ampm = istDate.getHours() >= 12 ? 'PM' : 'AM';

    return `${year}-${month}-${day}, ${hours}:${minutes} ${ampm}`;
  } catch (error) {
    console.error('Error formatting date to IST:', error);
    return 'Invalid date';
  }
};
