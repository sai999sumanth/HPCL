export default function convertToFilters(booleanObj) {
  return Object.entries(booleanObj)
    .filter(([_, value]) => value === true)
    .map(([key]) => ({
      key: `"${key}"`,
      cond: "equals",
      value: "true",
    }));
}


export const removeOldValues = (data) => {
  const uniqueFilters = data.reduce((acc, current) => {
    acc[current.key] = current; // Overwrite any existing key with the latest value
    return acc;
  }, {});

  return Object.values(uniqueFilters);
};