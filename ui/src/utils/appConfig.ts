import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { postBlueXPMessage, BlueXPListeners, useBlueXP } from '@netapp/design-system';
import { useAppDispatch } from '../store/storeHooks';
import queryString from 'query-string';
import { setAccountId, setAppContext } from '../store/appContextSlice';
import { updateAuthSuccess, updateResourceId, updateResourceName } from '../store/authSlice';
import { LOCAL, DATABASE_SERVICE_PATH } from './consts';
import Auth from './auth';

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

const useInitialize = () => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    useBlueXP({
        onReady: (initialData: any) => {
            console.log("Initial Data",initialData);
            const {accessToken, accountId } = initialData;
            dispatch(updateAuthSuccess({accessToken: accessToken}));
            dispatch(setAccountId(accountId));
            if(initialData?.pathname && initialData.pathname.split('/')[1] === 'database-services'){
              const storage = initialData?.storage;
              const storageId = initialData?.storageId;
              const storageName = initialData?.storageName;
              navigate(`${storage}/${storageId}/${storageName}`);
              dispatch(updateResourceId(storageId))
              dispatch(updateResourceName(storageName))
          } else {
              navigate(`${initialData?.pathname}`, { replace: true });
          }
        },
        onConnectorChange: function (connectorId: string): void {
            throw new Error('Function not implemented.');
        },
        onWorkspaceChange: function (workspaceId: string): void {
            throw new Error('Function not implemented.');
        },
        onTokenUpdate: function (accessToken: string, userMetadata: any): void {
            dispatch(updateAuthSuccess({accessToken: accessToken}))
        },
        onNssAdded: function (): void {
            throw new Error('Function not implemented.');
        },
        onNssAddingFailed: function (): void {
            throw new Error('Function not implemented.');
        },
        onLocationChange: function (pathname: string, hash: string, search: string): void {
            throw new Error('Function not implemented.');
        }
      });
}

// const useInitialize = () => {
//     const dispatch = useAppDispatch();
//     const navigate = useNavigate();

//     useHandleCmMessages({
//         onTokenUpdate: (payload: any) => dispatch(updateAuthSuccess(payload))
//     });

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

export { useInitialize, cmNavigateTo, navigateToCanvas };
