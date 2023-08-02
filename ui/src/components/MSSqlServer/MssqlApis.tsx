import { useAppDispatch, useAppSelector } from "../../store/storeHooks";
import { 
    useGetAdsListQuery, 
    useGetAmiListQuery, 
    useGetCredentialsQuery, 
    useGetKeyPairsQuery, 
    useGetKmsKeysQuery, 
    useGetRegionsQuery, 
    useGetSnsTopicsQuery, 
    useGetVPCListQuery } from "../../utils/apiService";
import { addAdsList, addAmiList, addCredentials, addKeyPairList, addKmsKeysList, addRegions, addSnsList, addVpcList } from "../../store/mssql/mssqlSlice";
import { useEffect, useState } from "react";
import { AWS_ASSUME_ROLE, DATABASE_TYPE, OS_TYPE, VPC_API_FIELDS } from "../../utils/consts";


const MssqlApis = () => {
    const dispatch = useAppDispatch();

    // CredentialId state
    const [selectedCredId, setSelectedCredId]= useState(undefined);

    // RegionCode state
    const [selectedRegionCode, setSelectedRegionCode]= useState(undefined);

    // credSkip to skip APi call when credentialId is not defined
    const [credSkip, setCredSkip] = useState(true);

    // credAndRegionSkip to skip APi call when credentialId and regionCode is not defined
    const [credAndRegionSkip, setCredAndRegionSkip] = useState(true);

    // licenseAmiSkip to skip AMI APi call when credentialId, regionCode, os, edition and version is not defined
    const [licenseAmiSkip, setLicenseAmiSkip] = useState(true);

    //Getting the Data from state
    const selectedCredentialData = useAppSelector((state) => state.mssqlForm.awsAccount.selectedCredential);
    const selectedRegionData = useAppSelector((state) => state.mssqlForm.regionAndVpc.selectedRegion);
    const osVersion = useAppSelector((state) => state.mssqlForm.operatingSystem);
    const dbEdition = useAppSelector((state) => state.mssqlForm.dbEdition);
    const dbVersion = useAppSelector((state) => state.mssqlForm.dbVersion);

    // API call to get credentials list for user account
    const { 
        data: credentialData,
        isFetching: credentialLoading,
        isError: credentialError,
    } = useGetCredentialsQuery({credentialsType: AWS_ASSUME_ROLE});

    // API call to get regions list for credentials
    const { 
        data: regionsData,
        isFetching: regionsLoading,
        isError: regionsError,
    } = useGetRegionsQuery({credentialId: selectedCredId}, {
        skip: credSkip,
    });

    // API call to get VPC list for selected credentials and region
    const { 
        data: vpcData,
        isFetching: vpcLoading,
        isError: vpcError,
    } = useGetVPCListQuery({credentialId: selectedCredId, region: selectedRegionCode, fields: VPC_API_FIELDS}, {
        skip: credAndRegionSkip,
    });

    // API call to get ADs list for selected credentials and region 
    const { 
        data: adsData,
        isFetching: adsLoading,
        isError: adsError,
    } = useGetAdsListQuery({credentialId: selectedCredId, region: selectedRegionCode}, {
        skip: credAndRegionSkip,
    });

    // API call to get AMIs list for selected credentials and region 
    const { 
        data: amiData,
        isFetching: amiLoading,
        isError: amiError,
    } = useGetAmiListQuery({credentialId: selectedCredId, region: selectedRegionCode, osType: OS_TYPE, 
        osVersion: osVersion?.value, databaseType: DATABASE_TYPE, databaseEdition: dbEdition?.value, databaseVersion: dbVersion?.value}, {
        skip: licenseAmiSkip,
    });

    // API call to get SNS Topics list for selected credentials and region 
    const { 
        data: snsData,
        isFetching: snsLoading,
        isError: snsError,
    } = useGetSnsTopicsQuery({credentialId: selectedCredId, region: selectedRegionCode}, {
        skip: credAndRegionSkip,
    });

    // API call to get KMS Keys list for selected credentials and region 
    const { 
        data: kmsData,
        isFetching: kmsLoading,
        isError: kmsError,
    } = useGetKmsKeysQuery({credentialId: selectedCredId, region: selectedRegionCode}, {
        skip: credAndRegionSkip,
    });

    // API call to get Key Pairs list for selected credentials and region 
    const { 
        data: keyPairData,
        isFetching: keyPairLoading,
        isError: keyPairError,
    } = useGetKeyPairsQuery({credentialId: selectedCredId, region: selectedRegionCode}, {
        skip: credAndRegionSkip,
    });

    // To add credentials information in MssqlEntities
    useEffect(() => {
        dispatch(addCredentials({credentialData, credentialLoading, credentialError}));
    });

    //Handle dependency cases
    useEffect(() => {
        const credId = selectedCredentialData?.data ? selectedCredentialData.data?.credentialsId : undefined;
        const regionCode = selectedRegionData?.data ? selectedRegionData.data?.regionCode : undefined;
        if(credId){
            setCredSkip(false);
            setSelectedCredId(credId);
        }else{
            setCredSkip(true);
        }
        if(regionCode){
            setCredAndRegionSkip(false);
            setSelectedRegionCode(regionCode);
        }else{
            setCredAndRegionSkip(true);
        }
        if(regionCode && credId && osVersion?.value && dbEdition?.value && dbVersion?.value){
            setLicenseAmiSkip(false);
        }else{
            setLicenseAmiSkip(true);
        }
    }, [selectedCredentialData, selectedRegionData, osVersion, dbEdition, dbVersion])

    // To add credentials information in MssqlEntities
    useEffect(() => {
        if(regionsError){
            dispatch(addRegions({undefined, regionsLoading, regionsError}));
        }else{
            dispatch(addRegions({regionsData, regionsLoading, regionsError}));
        }
    }, [dispatch, regionsData, regionsError, regionsLoading]);

    // To add VPC information in MssqlEntities
    useEffect(() => {
        if(vpcError){
            dispatch(addVpcList({undefined, vpcLoading, vpcError}));
        }else{
            dispatch(addVpcList({vpcData, vpcLoading, vpcError}));
        }
    }, [dispatch, vpcData, vpcLoading, vpcError]);

    // To add Ads information in MssqlEntities
    useEffect(() => {
        if(adsError){
            dispatch(addAdsList({undefined, adsLoading, adsError}));
        }else{
            dispatch(addAdsList({adsData, adsLoading, adsError}));
        }
    }, [dispatch, adsData , adsLoading, adsError]);

    // To add AMI information in MssqlEntities
    useEffect(() => {
        if(amiError){
            dispatch(addAmiList({undefined, amiLoading, amiError}));
        }else{
            dispatch(addAmiList({amiData, amiLoading, amiError}));
        }
    }, [dispatch, amiData , amiLoading, amiError]);

    // To add SNS information in MssqlEntities
    useEffect(() => {
        if(snsError){
            dispatch(addSnsList({undefined, snsLoading, snsError}));
        }else{
            dispatch(addSnsList({snsData, snsLoading, snsError}));
        }
    }, [dispatch, snsData , snsLoading, snsError]);

    // To add KMS Keys in MssqlEntities
    useEffect(() => {
        if(kmsError){
            dispatch(addKmsKeysList({undefined, kmsLoading, kmsError}));
        }else{
            dispatch(addKmsKeysList({kmsData, kmsLoading, kmsError}));
        }
    }, [dispatch, kmsData , kmsLoading, kmsError]);

    // To add Key Pair in MssqlEntities
    useEffect(() => {
        if(keyPairError){
            dispatch(addKeyPairList({undefined, keyPairLoading, keyPairError}));
        }else{
            dispatch(addKeyPairList({keyPairData, keyPairLoading, keyPairError}));
        }
    }, [dispatch, keyPairData , keyPairLoading, keyPairError]);

    return;
};

export default MssqlApis;