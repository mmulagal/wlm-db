import { useEffect, useRef } from "react";
import { useAppDispatch } from "../store/storeHooks";
import queryString from 'query-string';
import { setAppContext } from "../store/appContextSlice";
import { updateAuthFailed, updateAuthSuccess } from "../store/authSlice";
import { get } from "lodash";

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
                service: 'wlm-db'
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
        const isDemoMode = get(search, 'isDemoMode', 'false') === 'true';
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
                isDemoMode,
                environment
            };
            dispatch(setAppContext(appContext));
        }
        if (accessTokenAsString) {
            handleAuthSuccess({
                accessToken: accessTokenAsString,
            });
        }
        
        sendAppReady();

    }, [dispatch])

};

export { useInitialize };
