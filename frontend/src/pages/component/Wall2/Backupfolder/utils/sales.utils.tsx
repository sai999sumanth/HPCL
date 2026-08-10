export function convertToSpecificFormat(filtersObj: any[]) {
    return filtersObj.map((obj) => ({
      key: `"${obj.company}"`,
      cond: obj.operator || 'equals', 
      value: obj.value, 
    }));
  }
  
  export function convertListOfStringsToCommonFormat(list: string[]) {
    return list.map((item) => ({
      key: `"${item}"`, 
      cond: 'equals',
      value: 'true',
    }));
  }