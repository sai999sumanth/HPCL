import { useRef } from 'react';
import isEqual from 'lodash/isEqual';

export function useDeepCompareMemoize(value: any) {
    const ref = useRef();
    
    if (!isEqual(value, ref.current)) {
        ref.current = value;
    }

    return ref.current;
}