export const parentNavigate = (payload: { pathname: string; hash?: string; state?: any; search?: string }) => {
    window.parent.postMessage(
        {
            type: 'SERVICE:NAVIGATE',
            payload: payload
        },
        '*'
    );
};
