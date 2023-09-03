import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { postBlueXPMessage, BlueXPListeners, useBlueXP } from '@netapp/design-system';
import { useAppDispatch } from '../store/storeHooks';
import queryString from 'query-string';
import { setAppContext } from '../store/appContextSlice';
import { updateAuthSuccess, updateResourceId, updateResourceName } from '../store/authSlice';
import { LOCAL, DATABASE_SERVICE_PATH } from './consts';
import Auth from './auth';
import { BlueXPData } from '@netapp/design-system/dist/hooks/useBlueXP';

const AUTH_0_OPTIONS = {
    clientID: 'test-client-id',
    domain: process.env.REACT_APP_AUTH_DOMAIN,
    audience: process.env.REACT_APP_AUTH_AUDIENCE
};

const CM_ACTIONS = {
    ready: 'SERVICE:READY',
    navigate: 'SERVICE:NAVIGATE',
    onTokenUpdate: 'SERVICE:TOKEN-UPDATE'
};

const postCmMessage = ({ type, payload }: any) => {
    window.parent.postMessage({ type, payload }, '*');
};

const sendAppReady = () => {
    postCmMessage({
        type: CM_ACTIONS.ready,
        payload: {
            state: {
                service: 'wlmdb'
            }
        }
    });
};

const cmNavigateTo = (pathname: string, stateParams = {}) => {
    postCmMessage({
        type: CM_ACTIONS.navigate,
        payload: {
            pathname,
            state: {
                ...stateParams
            }
        }
    });
};

const navigateToCanvas = () => {
    postBlueXPMessage({
        type: BlueXPListeners.navigate,
        payload: {
            pathname: '/'
        }
    });
};

const useHandleCmMessages = (eventHandlers: any) => {
    const eventsHandlersRef = useRef(eventHandlers);
    eventsHandlersRef.current = eventHandlers;

    useEffect(() => {
        const messageHandler = (event: any) => {
            const { onTokenUpdate } = eventsHandlersRef.current;
            const { type, payload } = event.data;
            switch (type) {
                case CM_ACTIONS.onTokenUpdate:
                    const { auth0Token, userMetadata } = payload;
                    onTokenUpdate({ auth0Token, userMetadata });
                    break;
                default:
            }
        };
        window.addEventListener('message', messageHandler, false);
        return () => window.removeEventListener('message', messageHandler, false);
    }, []);
};

const pageRedirection = (initialState:any) => {
    // const {pathname, storageId, storageName, storage} = initialState;
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const dispatch = useAppDispatch();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const navigate = useNavigate();
    if(initialState?.pathname && initialState.pathname === '/database-services/i-0880a21327284f67c'){
        const storage = initialState?.storage;
        const storageId = initialState?.storageId;
        const storageName = initialState?.storageName;
        navigate(`${storage}/${storageId}/${storageName}`);
        dispatch(updateResourceId(storageId))
        dispatch(updateResourceName(storageName))
    } else {
        navigate(`${initialState?.pathname}`, { replace: true });
    }
};

// const useInitialize = () => {
//     const dispatch = useAppDispatch();
//     const navigate = useNavigate();

//     useHandleCmMessages({
//         onTokenUpdate: (payload: any) => dispatch(updateAuthSuccess(payload))
//     });

//     let accId = '';

//     useEffect(() => {
//         const search = queryString.parse(window.location.search) || {};
//         const { accountId, accessToken, pathname, storage, storageId, storageName } = search;
//         const accountIdAsString = Array.isArray(accountId) ? accountId[0] : accountId;
//         const accessTokenAsString = Array.isArray(accessToken) ? accessToken[0] : accessToken;
//         const environment = process.env.REACT_APP_ENVIRONMENT ?? null;

//         const handleAuthSuccess = (payload: any) => {
//             dispatch(updateAuthSuccess(payload));
//         };

//         if (accountIdAsString) {
//             const appContext = {
//                 accountId: accountIdAsString,
//                 environment
//             };
//             dispatch(setAppContext(appContext));
//         }

//         if(accessTokenAsString){
//             handleAuthSuccess({
//                 accessToken: accessTokenAsString || ''
//             });
//         }

//         if (environment === LOCAL) {
//             (window as any).auth = new Auth(AUTH_0_OPTIONS);
//             console.log(`connecting to auth0 with ${JSON.stringify(AUTH_0_OPTIONS)}`);

//             //start login flow
//             // refreshSso({
//             //     allowLoginRedirect: environment === LOCAL,
//             //     handleAuthSuccess,
//             //     handleAuthFailed
//             // });
//         }

//         if (pathname) {

//             if(pathname === DATABASE_SERVICE_PATH){
//                 navigate(`${storage}/${storageId}/${storageName}`);
//                 dispatch(updateResourceId(storageId))
//                 dispatch(updateResourceName(storageName))
//             } else {
//                 navigate(`${pathname}`, { replace: true });
//             }
//         }

//         sendAppReady();
//     }, [dispatch]);
// };

// const useInitialize = () => {

//     const dispatch = useAppDispatch();
//     const navigate = useNavigate();

//     // useHandleCmMessages({
//     //     onTokenUpdate: (payload: any) => dispatch(updateAuthSuccess(payload))
//     // });

//     // let accId = '';
//     // let accToken = '';

//     // useEffect(() => {
//     //     // const search = queryString.parse(window.location.search) || {};
//     //     // const { accountId, accessToken, pathname, storage, storageId, storageName } = search;
//     //     const accountIdAsString = Array.isArray(accId) ? accId[0] : accId;
//     //     const accessTokenAsString = Array.isArray(accToken) ? accToken[0] : accToken;
//     //     const environment = process.env.REACT_APP_ENVIRONMENT ?? null;

//     //     const handleAuthSuccess = (payload: any) => {
//     //         dispatch(updateAuthSuccess(payload));
//     //     };

//     //     if (accountIdAsString) {
//     //         const appContext = {
//     //             accountId: accountIdAsString,
//     //             environment
//     //         };
//     //         dispatch(setAppContext(appContext));
//     //     }

//     //     if(accessTokenAsString){
//     //         handleAuthSuccess({
//     //             accessToken: accessTokenAsString || ''
//     //         });
//     //     }

//     //     if (environment === LOCAL) {
//     //         (window as any).auth = new Auth(AUTH_0_OPTIONS);
//     //         console.log(`connecting to auth0 with ${JSON.stringify(AUTH_0_OPTIONS)}`);

//     //         //start login flow
//     //         // refreshSso({
//     //         //     allowLoginRedirect: environment === LOCAL,
//     //         //     handleAuthSuccess,
//     //         //     handleAuthFailed
//     //         // });
//     //     }

//     //     // if (pathname) {

//     //     //     if(pathname === DATABASE_SERVICE_PATH){
//     //     //         navigate(`${storage}/${storageId}/${storageName}`);
//     //     //         dispatch(updateResourceId(storageId))
//     //     //         dispatch(updateResourceName(storageName))
//     //     //     } else {
//     //     //         navigate(`${pathname}`, { replace: true });
//     //     //     }
//     //     // }

//     //     sendAppReady();
//     // }, [dispatch, accId, accToken]);

// };

export { cmNavigateTo, navigateToCanvas, pageRedirection };
