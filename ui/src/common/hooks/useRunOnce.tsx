import { useEffect, useState } from 'react';

export const useRunOnce = (callback: any) => {
    const [isRun, setIsRun] = useState(false);
    useEffect(() => {
        if (!isRun) {
            callback();
            setIsRun(true);
        }
    }, [isRun, setIsRun, callback]);
};
