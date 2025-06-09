import { useEffect, useRef } from 'react';

const useRunOnceWhenTruthy = (callback: Function, condition: boolean) => {
    const isAlreadyRun = useRef(false);

    useEffect(() => {
        if (condition && !isAlreadyRun.current) {
            callback();
            isAlreadyRun.current = true;
        }
    }, [isAlreadyRun, callback, condition]);
};

export default useRunOnceWhenTruthy;
