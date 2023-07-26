import { useAppDispatch } from "../../store/storeHooks";
import { useGetCredentialsQuery } from "../../utils/apiService";
import { addCredentials } from "../../store/mssqlSlice";
import { useEffect } from "react";


const MssqlApis = () => {
    const dispatch = useAppDispatch();

    const { 
        data: credentialData,
        isLoading: credentialLoading,
        isError: credentialError,
    } = useGetCredentialsQuery({credentialsType: 'aws_assume_role'});

    useEffect(() => {
        dispatch(addCredentials({credentialData, credentialLoading, credentialError}));
    });

    return;
};

export default MssqlApis;