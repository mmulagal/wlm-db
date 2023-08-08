import { useEffect, useRef } from "react";
import { useAppDispatch } from "../store/storeHooks";
import queryString from 'query-string';
import { setAppContext } from "../store/appContextSlice";
import { updateAuthFailed, updateAuthSuccess } from "../store/authSlice";
import { LOCAL } from "./consts";
import Auth, { refreshSso } from './auth';

const AUTH_0_OPTIONS = {
    clientID: process.env.REACT_APP_AUTH_CLIENT,
    domain: process.env.REACT_APP_AUTH_DOMAIN,
    audience: process.env.REACT_APP_AUTH_AUDIENCE
};

const CM_ACTIONS = {
    ready: 'SERVICE:READY',
    navigate: 'SERVICE:NAVIGATE',
    onTokenUpdate: 'SERVICE:TOKEN-UPDATE',
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

const useHandleCmMessages = (eventHandlers: any) => {
    const eventsHandlersRef = useRef(eventHandlers);
    eventsHandlersRef.current = eventHandlers;

    useEffect(() => {
        const messageHandler = (event: any) => {
            const {
                onTokenUpdate,
            } = eventsHandlersRef.current;
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
        return () =>
            window.removeEventListener('message', messageHandler, false);
    }, []);
};

const useInitialize = () => {
    const dispatch = useAppDispatch();

    useHandleCmMessages({
        onTokenUpdate: (payload: any) => dispatch(updateAuthSuccess(payload))
    });

    useEffect(() => {
        const search = queryString.parse(window.location.search) || {};
        const { accountId, accessToken } = search;
        const accountIdAsString = Array.isArray(accountId)
            ? accountId[0]
            : accountId;
        const accessTokenAsString = Array.isArray(accessToken)
            ? accessToken[0]
            : accessToken;
        const environment = process.env.REACT_APP_ENVIRONMENT ?? null;

        const handleAuthSuccess = (payload: any) => {
            dispatch(updateAuthSuccess(payload));
        };

        const handleAuthFailed = (payload: any) => {
            dispatch(updateAuthFailed(payload));
        };

        if (accountIdAsString) {
            const appContext = {
                accountId: accountIdAsString,
                environment
            };
            dispatch(setAppContext(appContext));
        }
        
        handleAuthSuccess({
            accessToken: accessTokenAsString || '',
        });

        if (environment === LOCAL) {
            (window as any).auth = new Auth(AUTH_0_OPTIONS);
            console.log(`connecting to auth0 with ${JSON.stringify(AUTH_0_OPTIONS)}`);

            //start login flow
            // refreshSso({
            //     allowLoginRedirect: environment === LOCAL,
            //     handleAuthSuccess,
            //     handleAuthFailed
            // });
        }
        
        sendAppReady();

    }, [dispatch])

};

export { useInitialize, cmNavigateTo };
