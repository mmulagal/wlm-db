import { useEffect, useState } from 'react';

export const useDelayedError = (errorStr: any) => {
    const [error, setError] = useState(undefined);

    useEffect(() => {
        if (errorStr) {
            setError(undefined);
            setTimeout(() => setError(errorStr), 1000);
        }
    }, [errorStr]);

    return errorStr ? error : '';
};
