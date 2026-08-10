export const calculateInboxTime = (processedTime, allocatedTime) => {
  const processed = new Date(processedTime).getTime();
  const allocated = new Date(allocatedTime).getTime();
  const diffInMinutes = Math.floor((processed - allocated) / (1000 * 60));
  
  const days = Math.floor(diffInMinutes / (24 * 60));
  const remainingHours = Math.floor((diffInMinutes % (24 * 60)) / 60);
  const remainingMinutes = diffInMinutes % 60;
  
  const parts = [];
  
  if (days > 0) {
    parts.push(`${days}d`);
  }

  if (remainingHours > 0 || days > 0) {
    parts.push(`${remainingHours}h`);
  }

  parts.push(`${remainingMinutes}m`);
  
  return parts.join(' ');
};