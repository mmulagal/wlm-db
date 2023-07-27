import { useAppDispatch } from "../../store/storeHooks";
import { useGetCredentialsQuery } from "../../utils/apiService";
import { addCredentials } from "../../store/mssql/mssqlSlice";
import { useEffect } from "react";
import { AWS_ASSUME_ROLE } from "../../utils/consts";


const MssqlApis = () => {
    const dispatch = useAppDispatch();

    // API call to get credentials list for user account
    const { 
        data: credentialData,
        isLoading: credentialLoading,
        isError: credentialError,
    } = useGetCredentialsQuery({credentialsType: AWS_ASSUME_ROLE});

    useEffect(() => {
        dispatch(addCredentials({credentialData, credentialLoading, credentialError}));
    });

    return;
};

export default MssqlApis;