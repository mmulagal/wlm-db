import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { postBlueXPMessage, BlueXPListeners, useBlueXP } from '@netapp/design-system';
import { useAppDispatch } from '../store/storeHooks';
import queryString from 'query-string';
import { 
    updateAccountId, 
    updateAuthSuccess, 
    updateIsLoading, 
    updatePathname, 
    updateResourceId, 
    updateResourceName, 
    updateWorkspaceId 
} from '../store/authSlice';
import { DATABASE_SERVICE_PATH } from './consts';

const navigateToCanvas = (pathname: string) => {
    postBlueXPMessage({
        type: BlueXPListeners.navigate,
        payload: {
            pathname
        }
    });
};

const useInitialize = () => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    useEffect(() => {
        const search = queryString.parse(window.location.search) || {};
        const { accountId, accessToken, pathname, storage, storageId, storageName, workspaceId } = search;
        const accountIdAsString = Array.isArray(accountId) ? accountId[0] : accountId;
        const accessTokenAsString = Array.isArray(accessToken) ? accessToken[0] : accessToken;
        const workspaceIdAsString = Array.isArray(workspaceId) ? workspaceId[0] : workspaceId;

        if(accountIdAsString){
            dispatch(updateAccountId(accountIdAsString || ''));
        }

        if(accessTokenAsString){
            dispatch(updateAuthSuccess({accessToken: accessTokenAsString || ''}));
        }

        if(workspaceIdAsString){
            dispatch(updateWorkspaceId(workspaceIdAsString));
        }

        const pathnameAsString = Array.isArray(pathname) ? pathname[0] : pathname;
        if (pathnameAsString) {
            if(pathnameAsString.includes('/') && pathnameAsString.split('/')[1] === DATABASE_SERVICE_PATH){
                navigate(`${storage}/${storageId}/${storageName}`);
                dispatch(updateResourceId(storageId));
                dispatch(updateResourceName(storageName));
            } else {
                navigate(`${pathnameAsString}`, { replace: true });
            }
        }

        dispatch(updateIsLoading(false));
    });

    useBlueXP({
        onReady: (initialData: any) => {
            const {accessToken, accountId } = initialData;
            dispatch(updateAuthSuccess({accessToken: accessToken}));
            dispatch(updateAccountId(accountId));
            dispatch(updateIsLoading(false));
            
            if(initialData?.pathname && initialData.pathname.split('/')[1] === DATABASE_SERVICE_PATH){
                const storage = initialData?.storage;
                const storageId = initialData?.storageId;
                const storageName = initialData?.storageName;
                navigate(`${storage}/${storageId}/${storageName}`);
                dispatch(updateResourceId(storageId));
                dispatch(updateResourceName(storageName));
            } else {
                navigate(`${initialData?.pathname}`, { replace: true });
            }
        },
        onConnectorChange: function (connectorId: string): void {},
        onWorkspaceChange: function (workspaceId: string): void {
            dispatch(updateWorkspaceId(workspaceId));
        },
        onTokenUpdate: function (accessToken: string, userMetadata: any): void {
            dispatch(updateAuthSuccess({accessToken: accessToken}));
        },
        onNssAdded: function (): void {},
        onNssAddingFailed: function (): void {},
        onLocationChange: function (pathname: string, hash: string, search: string): void {
            dispatch(updatePathname(pathname));
        }
      });
}

export { useInitialize, navigateToCanvas };
