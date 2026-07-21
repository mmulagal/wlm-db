import { useEffect, useState } from 'react';
import {
    useGetAccountInfoQuery,
    useGetHeadersCredentialsQuery,
    useGetHeadersRegionsQuery,
    useGetHeadersRegionsWithoutCredQuery,
    useGetStatusQuery
} from '../../../utils/apiService';
import { AWS_ASSUME_ROLE } from '../../../utils/consts';
import { useAppDispatch, useAppSelector } from '../../../store/storeHooks';
import {
    addCredentialsHeaderList,
    addRegionsHeaderList,
    addStatus,
    setCredentialMapping,
    setRegionMapping,
    setShowNA
} from '../../../store/workloadFactory/headersSlice';
import { updateAiAnalysisEnabled, updateIsGovAccount } from '../../../store/authSlice';
import { makeCredMapping, makeRegionMapping } from '../../../utils/utilityFunctions';

const HeaderComponentApi = () => {
    const dispatch = useAppDispatch();
    const { headerSelectedMultiCred, headerSelectedCredSandbox } = useAppSelector(state => state.headers);
    const isDemoMode = useAppSelector(state => state.auth.isDemoMode);

    // CredentialId state
    const [selectedCredId, setSelectedCredId] = useState(undefined);

    // credSkip to skip APi call when credentialId is not defined
    const [credSkip, setCredSkip] = useState(true);

    // skipApiCall to skip APi call when isActive is not true
    const [skipApiCall, setSkipApiCall] = useState(true);

    const { data: statusData, isFetching: statusLoading, isError: statusError } = useGetStatusQuery('');
    const { data: accountInfoData } = useGetAccountInfoQuery('');

    // API call to get credentials list for user account
    const {
        data: credentialData,
        isFetching: credentialLoading,
        isError: credentialError
    } = useGetHeadersCredentialsQuery({ credentialsType: AWS_ASSUME_ROLE }, { skip: skipApiCall });

    // API call to get regions list for credentials
    const {
        data: regionsData,
        isFetching: regionsLoading,
        isError: regionsError
    } = useGetHeadersRegionsWithoutCredQuery(
        {},
        {
            skip: credSkip
        }
    );

    useEffect(() => {
        if (accountInfoData) {
            dispatch(updateIsGovAccount(accountInfoData.isGovAccount));
            dispatch(updateAiAnalysisEnabled(accountInfoData.aiAnalysisEnabled));
        }
    }, [accountInfoData, dispatch]);

    useEffect(() => {
        if (statusError) {
            dispatch(addStatus({ undefined, statusLoading, statusError }));
            dispatch(setShowNA(true));
        } else {
            dispatch(addStatus({ statusData, statusLoading, statusError }));
            if (isDemoMode || (statusData && statusData?.isActive)) {
                setSkipApiCall(false);
            }
        }
        if (statusData && !statusData?.isActive) {
            dispatch(setShowNA(true));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusData, statusLoading, statusError]);

    useEffect(() => {
        const credId = headerSelectedMultiCred?.[0]?.data
            ? headerSelectedMultiCred[0].data?.credentialsId
            : headerSelectedCredSandbox?.data
            ? headerSelectedCredSandbox.data?.credentialsId
            : null;
        if (credId) {
            setSelectedCredId(credId);
            setCredSkip(false);
        } else {
            setCredSkip(true);
        }
    }, [headerSelectedMultiCred, headerSelectedCredSandbox]);

    useEffect(() => {
        dispatch(addCredentialsHeaderList({ credentialData, credentialLoading, credentialError }));
        dispatch(setCredentialMapping(makeCredMapping(credentialData)));

        // Set showNA flag based on credentials availability
        // Only set to false if credentials exist AND status is active (not error)
        const hasNoCredentials = credentialData && credentialData.length === 0;
        const isStatusInactive = statusError || (statusData && !statusData?.isActive);

        // showNA should be true if: no credentials OR status error OR status inactive
        dispatch(setShowNA(hasNoCredentials || isStatusInactive));

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [credentialData, credentialLoading, credentialError, statusData, statusError]);

    useEffect(() => {
        if (regionsError) {
            dispatch(addRegionsHeaderList({ undefined, regionsLoading, regionsError }));
        } else {
            dispatch(addRegionsHeaderList({ regionsData, regionsLoading, regionsError }));
            dispatch(setRegionMapping(makeRegionMapping(regionsData?.regions)));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [regionsData, regionsError, regionsLoading]);
};

export default HeaderComponentApi;
