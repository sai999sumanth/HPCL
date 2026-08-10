export const getYesterdayDate = (): string => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Get day, month, and year
    const day = yesterday.getDate().toString().padStart(2, '0');
    const month = yesterday.toLocaleString('en-US', { month: 'short' });
    const year = yesterday.getFullYear();
    
    return `${day}-${month}-${year}`;
  };
