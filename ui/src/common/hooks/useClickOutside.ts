import { useEffect, useRef } from 'react';

const useClickOutside = (callback:Function) => {
  const ref = useRef<any>(null)
      useEffect(() => {
      function handleClickOutside(event:MouseEvent) {
        // @ts-ignore
        if (ref.current && !ref.current.contains(event?.target)) {
          callback()
        }
      }
      // Bind the event listener
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        // Unbind the event listener on clean up
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [ref,callback]);
  return ref
};

export default useClickOutside;