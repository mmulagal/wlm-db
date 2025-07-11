import { useEffect, useState } from 'react';
import {
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
        if (statusError) {
            dispatch(addStatus({ undefined, statusLoading, statusError }));
        } else {
            dispatch(addStatus({ statusData, statusLoading, statusError }));
            if (isDemoMode || (statusData && statusData?.isActive)) {
                setSkipApiCall(false);
            }
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
        const hasNoCredentials = credentialData && credentialData.length === 0;
        dispatch(setShowNA(hasNoCredentials));

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [credentialData, credentialLoading, credentialError]);

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
