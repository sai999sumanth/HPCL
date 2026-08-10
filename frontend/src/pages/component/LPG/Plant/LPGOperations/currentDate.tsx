import React, { useEffect, useState } from 'react';

const currentDate = ({ className = "" }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const updateDate = () => {
      setCurrentDate(new Date());
    };

    // Update date at midnight
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

  const formatDate = (date) => {
    const options = { 
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    };
    return date.toLocaleDateString('en-GB', options).replace(/ /g, '-');
  };

  return (
    <span className={className}>
      {formatDate(currentDate)}
    </span>
  );
};

export default currentDate;