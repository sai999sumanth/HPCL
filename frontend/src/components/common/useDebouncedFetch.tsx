import { useEffect, useRef, useCallback } from 'react';
import { debounce } from 'lodash';

const useDebouncedFetch = ({
  fetchFunction,
  dependencies,
  memoizedParams,
  delay = 100,
}) => {
  const didMountRef = useRef(false);
  const hasFetchedRef = useRef(false);
  const lastFetchedParamsRef = useRef(null);

  const debouncedFetchData = useCallback(
    debounce((params) => {
      fetchFunction(params);
      hasFetchedRef.current = true;
    }, delay),
    [fetchFunction, delay]
  );

  useEffect(() => {    
    const shouldFetchData = () => {
      if (!didMountRef.current) {
        return true;
      }
      if (!hasFetchedRef.current) {
        return true;
      }
      const paramsChanged = JSON.stringify(memoizedParams) !== JSON.stringify(lastFetchedParamsRef.current);
      return paramsChanged;
    };

    if (shouldFetchData()) {
      didMountRef.current = true;
      debouncedFetchData(memoizedParams);
      lastFetchedParamsRef.current = memoizedParams;
    } else {
      // console.log('Skipping fetch, no changes detected');
    }

    return () => {
      debouncedFetchData.cancel();
    };
  }, [debouncedFetchData, ...dependencies]);
};

export default useDebouncedFetch;