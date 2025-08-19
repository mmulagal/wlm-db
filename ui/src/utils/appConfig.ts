import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { postBlueXPMessage, BlueXPListeners, useBlueXP } from '@netapp/design-system';
import queryString from 'query-string';
import { useAppDispatch } from '../store/storeHooks';
import {
    updateAccountId,
    updateAuthSuccess,
    updateFeatures,
    updateOrgId,
    updateIsDemoMode,
    updateIsLoading,
    updateIsWorkloadfactory,
    updatePathname,
    updateResourceId,
    updateResourceName,
    updateUserMetaData,
    updateWorkspaceId
} from '../store/authSlice';
import { DATABASE_SERVICE_PATH, WORKLOADS } from './consts';
import { encodeAll } from './utilityFunctions';

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
        // const search = queryString.parse(window.location.search) || {};
        // const { accountId, accessToken, pathname, storage, storageId, storageName, workspaceId, isDemoMode } = search;
        // const accountIdAsString = Array.isArray(accountId) ? accountId[0] : accountId;
        // const accessTokenAsString = Array.isArray(accessToken) ? accessToken[0] : accessToken;
        // const workspaceIdAsString = Array.isArray(workspaceId) ? workspaceId[0] : workspaceId;
        // const isDemoFlag = Array.isArray(isDemoMode) ? isDemoMode[0] : isDemoMode;
        const checkForPlatform = () => {
            if (navigator.userAgent.includes('Chrome')) {
                if (
                    !window.location ||
                    !window.location.ancestorOrigins ||
                    !window.location.ancestorOrigins.length ||
                    window.location.ancestorOrigins[0].includes(WORKLOADS)
                ) {
                    return true;
                }
                return false;
            }
            if (document.referrer.includes(WORKLOADS)) {
                return true;
            }
            return false;
        };
        const isWorkloadFactory = checkForPlatform();

        // dispatch(updateIsDemoMode(isDemoFlag === 'true' ? true : false));
        dispatch(updateIsWorkloadfactory(isWorkloadFactory));

        // if (accountIdAsString) {
        //     dispatch(updateAccountId(accountIdAsString || ''));
        // }

        // if (accessTokenAsString) {
        //     dispatch(updateAuthSuccess({ accessToken: accessTokenAsString || '' }));
        // }

        // if (workspaceIdAsString) {
        //     dispatch(updateWorkspaceId(workspaceIdAsString));
        // }

        // const pathnameAsString = Array.isArray(pathname) ? pathname[0] : pathname;
        // const storageNameAsString = (Array.isArray(storageName) ? storageName[0] : storageName) || '';
        // if (pathnameAsString) {
        //     if (pathnameAsString.includes('/') && pathnameAsString.split('/')[1] === DATABASE_SERVICE_PATH) {
        //         navigate(`${storage}/${storageId}/${encodeAll(storageNameAsString)}`);
        //         dispatch(updateResourceId(storageId));
        //         dispatch(updateResourceName(storageNameAsString));
        //     } else {
        //         navigate(`${pathnameAsString}`, { replace: true });
        //     }
        // }

        // dispatch(updateIsLoading(false));
    });

    useBlueXP({
        onReady: (initialData: any) => {
            const { accessToken, accountId, isDemoMode, features, userMetadata, organizationId } = initialData;
            dispatch(updateUserMetaData(userMetadata));
            dispatch(updateFeatures(features));
            dispatch(updateAuthSuccess({ accessToken }));
            dispatch(updateAccountId(accountId));
            dispatch(updateOrgId(organizationId));
            dispatch(updateIsLoading(false));
            dispatch(updateIsDemoMode(isDemoMode));

            if (initialData?.pathname && initialData.pathname.split('/')[1] === DATABASE_SERVICE_PATH) {
                const storage = initialData?.storage;
                const storageId = initialData?.storageId;
                const storageName = initialData?.storageName;
                const workspaceId = initialData?.workspaceId;
                navigate(`${storage}/${storageId}/${encodeAll(storageName)}`);
                dispatch(updateResourceId(storageId));
                dispatch(updateResourceName(storageName));
                dispatch(updateWorkspaceId(workspaceId));
            } else {
                navigate(`${initialData?.pathname}`, { replace: true });
            }
        },
        onConnectorChange(connectorId: string): void {},
        onWorkspaceChange(workspaceId: string): void {
            dispatch(updateWorkspaceId(workspaceId));
        },
        onTokenUpdate(accessToken: string, userMetadata: any): void {
            dispatch(updateAuthSuccess({ accessToken }));
        },
        onNssAdded(): void {},
        onNssAddingFailed(): void {},
        onLocationChange(pathname: string, hash: string, search: string): void {
            dispatch(updatePathname(pathname));
        }
    });
};

export { useInitialize, navigateToCanvas };
