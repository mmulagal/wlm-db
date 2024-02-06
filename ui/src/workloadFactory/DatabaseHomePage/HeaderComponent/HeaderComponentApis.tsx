import { useEffect, useState } from "react";
import { useGetHeadersCredentialsQuery, useGetHeadersRegionsQuery } from "../../../utils/apiService";
import { AWS_ASSUME_ROLE } from "../../../utils/consts";
import { useAppDispatch, useAppSelector } from "../../../store/storeHooks";
import { addCredentialsHeaderList, addRegionsHeaderList } from "../../../store/workloadFactory/headersSlice";

const HeaderComponentApi = () => {
    const dispatch = useAppDispatch();
    const selectedCredential = useAppSelector(state => state.headers.headerSelectedCred);

    // CredentialId state
    const [selectedCredId, setSelectedCredId] = useState(undefined);

    // credSkip to skip APi call when credentialId is not defined
    const [credSkip, setCredSkip] = useState(true);

    // API call to get credentials list for user account
    const {
        data: credentialData,
        isFetching: credentialLoading,
        isError: credentialError
    } = useGetHeadersCredentialsQuery({ credentialsType: AWS_ASSUME_ROLE });

    // API call to get regions list for credentials
    const {
        data: regionsData,
        isFetching: regionsLoading,
        isError: regionsError
    } = useGetHeadersRegionsQuery(
        { credentialId: selectedCredId },
        {
            skip: credSkip
        }
    );

    useEffect(() => {
        const credId = selectedCredential?.data ? selectedCredential.data?.credentialsId : undefined;
        if (credId) {
            setSelectedCredId(credId);
            setCredSkip(false);
        } else {
            setCredSkip(true);
        }
    }, [selectedCredential]);

    useEffect(() => {
        dispatch(addCredentialsHeaderList({ credentialData, credentialLoading, credentialError }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [credentialData, credentialLoading, credentialError]);

    useEffect(() => {
        if (regionsError) {
            dispatch(addRegionsHeaderList({ undefined, regionsLoading, regionsError }));
        } else {
            dispatch(addRegionsHeaderList({ regionsData, regionsLoading, regionsError }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [regionsData, regionsError, regionsLoading]);

    return;
};

export default HeaderComponentApi;
