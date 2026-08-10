import { useEffect, RefObject } from 'react';

type Handler = (event: MouseEvent | TouchEvent) => void;

/**
 * A custom hook that triggers a handler function when a click occurs outside of the referenced element.
 * @param ref - A React ref object pointing to the element to monitor.
 * @param handler - The function to call when a click outside is detected.
 */
export function useOnClickOutside<T extends HTMLElement = HTMLElement>(
  ref: RefObject<T>,
  handler: Handler
): void {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      // Do nothing if clicking ref's element or descendent elements
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}
