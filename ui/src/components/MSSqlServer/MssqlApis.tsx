import { useAppDispatch, useAppSelector } from "../../store/storeHooks";
import { useGetAdsListQuery, useGetAmiListQuery, useGetCredentialsQuery, useGetRegionsQuery, useGetSnsTopicsQuery, useGetVPCListQuery } from "../../utils/apiService";
import { addAdsList, addAmiList, addCredentials, addRegions, addVpcList } from "../../store/mssql/mssqlSlice";
import { useEffect, useState } from "react";
import { AWS_ASSUME_ROLE } from "../../utils/consts";


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

    //Getting the Data from state
    const selectedCredentialData = useAppSelector((state) => state.mssqlForm.awsAccount.selectedCredential);
    const selectedRegionData = useAppSelector((state) => state.mssqlForm.regionAndVpc.selectedRegion);

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
    } = useGetVPCListQuery({credentialId: selectedCredId, region: selectedRegionCode}, {
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
    } = useGetAmiListQuery({credentialId: selectedCredId, region: selectedRegionCode}, {
        skip: credAndRegionSkip,
    });

    // API call to get SNS Topics list for selected credentials and region 
    const { 
        data: snsData,
        isFetching: snsLoading,
        isError: snsError,
    } = useGetSnsTopicsQuery({credentialId: selectedCredId, region: selectedRegionCode}, {
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
    }, [selectedCredentialData, selectedRegionData])

    // To add credentials information in MssqlEntities
    useEffect(() => {
        dispatch(addRegions({regionsData, regionsLoading, regionsError}));
    }, [dispatch, regionsData, regionsError, regionsLoading]);

    // To add VPC information in MssqlEntities
    useEffect(() => {
        dispatch(addVpcList({vpcData, vpcLoading, vpcError}));
    }, [dispatch, vpcData, vpcLoading, vpcError]);

    // To add Ads information in MssqlEntities
    useEffect(() => {
        dispatch(addAdsList({adsData, adsLoading, adsError}));
    }, [dispatch, adsData , adsLoading, adsError]);

    // To add AMI information in MssqlEntities
    useEffect(() => {
        dispatch(addAmiList({amiData, amiLoading, amiError}));
    }, [dispatch, amiData , amiLoading, amiError]);

    // To add SNS information in MssqlEntities
    useEffect(() => {
        dispatch(addAmiList({snsData, snsLoading, snsError}));
    }, [dispatch, snsData , snsLoading, snsError]);

    return;
};

export default MssqlApis;