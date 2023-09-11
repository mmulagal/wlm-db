import { useAppDispatch, useAppSelector } from '../../../store/storeHooks';
import {
    useGetAdsListQuery,
    useGetAmiListQuery,
    useGetConfigListQuery,
    useGetCredentialsQuery,
    useGetFsxnListQuery,
    useGetInstanceTypesQuery,
    useGetKeyPairsQuery,
    useGetKmsKeysQuery,
    useGetRegionsQuery,
    useGetSnsTopicsQuery,
    useGetVPCListQuery
} from '../../../utils/apiService';
import {
    addAdsList,
    addAmiList,
    addCredentials,
    addFsxnList,
    addInstanceTypeList,
    addKeyPairList,
    addKmsKeysList,
    addRegions,
    addSavedConfigList,
    addSnsList,
    addVpcList
} from '../../../store/mssql/mssqlSlice';
import { useEffect, useState } from 'react';
import { API_NAME, AWS_ASSUME_ROLE, DATABASE_TYPE, DEAFULT_INSTANCE_VALUE, OS_TYPE, VPC_API_FIELDS } from '../../../utils/consts';
import { formatKmsData, formatSize, generateOptionType } from '../../../utils/utilityFunctions';
import { setEncryptionRow, setInstanceType, setSelectedKeyPair, setSelectedLicenseId } from '../../../store/mssql/mssqlFormSlice';
import { SELECT_CONFIG } from '../../../utils/appConstants';
import { setRefetchApiCountRan } from '../../../store/mssql/msSqlActionSlice';


const MssqlApis = () => {
    const dispatch = useAppDispatch();
    const selectedConfig = useAppSelector(state => state.mssqlForm.selectConfig);

    // CredentialId state
    const [selectedCredId, setSelectedCredId] = useState(undefined);

    // RegionCode state
    const [selectedRegionCode, setSelectedRegionCode] = useState(undefined);

    // VPC ID state
    const [selectedVpcId, setSelectedVpcId] = useState(undefined);

    // credSkip to skip APi call when credentialId is not defined
    const [credSkip, setCredSkip] = useState(true);

    // credAndRegionSkip to skip APi call when credentialId and regionCode is not defined
    const [credAndRegionSkip, setCredAndRegionSkip] = useState(true);

    // licenseAmiSkip to skip AMI APi call when credentialId, regionCode, os, edition and version is not defined
    const [licenseAmiSkip, setLicenseAmiSkip] = useState(true);

    // fsxnSkip to skip FSxN API call when credentialId, regionCode, vpcId is not defined
    const [fsxnSkip, setFsxnSkip] = useState(true);

    //Getting the Data from state
    const selectedCredentialData = useAppSelector(state => state.mssqlForm.awsAccount.selectedCredential);
    const selectedRegionData = useAppSelector(state => state.mssqlForm.regionAndVpc.selectedRegion);
    const selectedVpcData = useAppSelector(state => state.mssqlForm.regionAndVpc.selectedVPC);
    const osVersion = useAppSelector(state => state.mssqlForm.operatingSystem);
    const dbEdition = useAppSelector(state => state.mssqlForm.dbEdition);
    const dbVersion = useAppSelector(state => state.mssqlForm.dbVersion);
    const isLoadConfig = useAppSelector(state => state.msSqlAction.isLoadConfig);
    const refetchApiCount = useAppSelector(state => state.msSqlAction.refetchApiCount);

    // API call to get credentials list for user account
    const {
        data: credentialData,
        isFetching: credentialLoading,
        isError: credentialError
    } = useGetCredentialsQuery({ credentialsType: AWS_ASSUME_ROLE });

    // API call to get regions list for credentials
    const {
        data: regionsData,
        isFetching: regionsLoading,
        isError: regionsError
    } = useGetRegionsQuery(
        { credentialId: selectedCredId },
        {
            skip: credSkip
        }
    );

    // API call to get VPC list for selected credentials and region
    const {
        data: vpcData,
        isFetching: vpcLoading,
        isError: vpcError
    } = useGetVPCListQuery(
        { credentialId: selectedCredId, region: selectedRegionCode, fields: VPC_API_FIELDS },
        {
            skip: credAndRegionSkip
        }
    );

    // API call to get ADs list for selected credentials and region
    const {
        data: adsData,
        isFetching: adsLoading,
        isError: adsError
    } = useGetAdsListQuery(
        { credentialId: selectedCredId, region: selectedRegionCode },
        {
            skip: credAndRegionSkip
        }
    );

    // API call to get AMIs list for selected credentials and region
    const {
        data: amiData,
        isFetching: amiLoading,
        isError: amiError
    } = useGetAmiListQuery(
        {
            credentialId: selectedCredId,
            region: selectedRegionCode,
            osType: OS_TYPE,
            osVersion: osVersion?.value,
            databaseType: DATABASE_TYPE,
            databaseEdition: dbEdition?.value,
            databaseVersion: dbVersion?.value
        },
        {
            skip: licenseAmiSkip
        }
    );

    // API call to get SNS Topics list for selected credentials and region
    const {
        data: snsData,
        isFetching: snsLoading,
        isError: snsError
    } = useGetSnsTopicsQuery(
        { credentialId: selectedCredId, region: selectedRegionCode },
        {
            skip: credAndRegionSkip
        }
    );

    // API call to get KMS Keys list for selected credentials and region
    const {
        data: kmsList,
        isFetching: kmsLoading,
        isError: kmsError
    } = useGetKmsKeysQuery(
        { credentialId: selectedCredId, region: selectedRegionCode },
        {
            skip: credAndRegionSkip
        }
    );

    // API call to get Key Pairs list for selected credentials and region
    const {
        data: keyPairData,
        isFetching: keyPairLoading,
        isError: keyPairError
    } = useGetKeyPairsQuery(
        { credentialId: selectedCredId, region: selectedRegionCode },
        {
            skip: credAndRegionSkip
        }
    );

    // API call to get Instance Types list for selected credentials and region
    const {
        data: instanceTypeData,
        isFetching: instanceTypeLoading,
        isError: instanceTypeError
    } = useGetInstanceTypesQuery(
        { credentialId: selectedCredId, region: selectedRegionCode },
        {
            skip: credAndRegionSkip
        }
    );

    // API call to get FSxN list for selected credentials, region and vpc
    const {
        data: fsxnData,
        isFetching: fsxnLoading,
        isError: fsxnError
    } = useGetFsxnListQuery(
        { credentialId: selectedCredId, region: selectedRegionCode, vpcId: selectedVpcId },
        {
            skip: fsxnSkip
        }
    );

    // API call to get saved configuration list
    const {
        data: configData,
        isFetching: configLoading,
        isError: configError
    } = useGetConfigListQuery({});

    // To add credentials information in MssqlEntities
    useEffect(() => {
        dispatch(addCredentials({ credentialData, credentialLoading, credentialError }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [credentialData, credentialLoading, credentialError]);

    //Handle dependency cases
    useEffect(() => {
        const credId = selectedCredentialData?.data ? selectedCredentialData.data?.credentialsId : undefined;
        const regionCode = selectedRegionData?.data ? selectedRegionData.data?.regionCode : undefined;
        const vpcId = selectedVpcData?.data ? selectedVpcData?.data?.id : undefined;
        if (regionCode) {
            setSelectedRegionCode(regionCode);
        }
        if (vpcId) {
            setSelectedVpcId(vpcId);
        } 
        if (credId) {
            setCredSkip(false);
            setSelectedCredId(credId);
        } else {
            setCredSkip(true);
        }
        if (credId && regionCode) {
            setCredAndRegionSkip(false);
        } else {
            setCredAndRegionSkip(true);
        }
        if (regionCode && credId && osVersion?.value && dbEdition?.value && dbVersion?.value) {
            setLicenseAmiSkip(false);
        } else {
            setLicenseAmiSkip(true);
        }
        if (vpcId && regionCode && credId) {
            setFsxnSkip(false);
        } else {
            setFsxnSkip(true);
        }
    }, [selectedCredentialData, selectedRegionData, selectedVpcData, osVersion, dbEdition, dbVersion]);

    // To add credentials information in MssqlEntities
    useEffect(() => {
        if (regionsError) {
            dispatch(addRegions({ undefined, regionsLoading, regionsError }));
        } else {
            dispatch(addRegions({ regionsData, regionsLoading, regionsError }));
        }
        if(!regionsLoading && isLoadConfig && refetchApiCount?.isLoading && (API_NAME.REGION in refetchApiCount?.expected)){
            dispatch(setRefetchApiCountRan(API_NAME.REGION));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [regionsData, regionsError, regionsLoading]);

    // To add VPC information in MssqlEntities
    useEffect(() => {
        if (vpcError) {
            dispatch(addVpcList({ undefined, vpcLoading, vpcError }));
        } else {
            dispatch(addVpcList({ vpcData, vpcLoading, vpcError }));
        }
        if(!vpcLoading && isLoadConfig && refetchApiCount?.isLoading && (API_NAME.VPC in refetchApiCount?.expected)){
            dispatch(setRefetchApiCountRan(API_NAME.VPC))
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vpcData, vpcLoading, vpcError]);

    // To add Ads information in MssqlEntities
    useEffect(() => {
        if (adsError) {
            dispatch(addAdsList({ undefined, adsLoading, adsError }));
        } else {
            dispatch(addAdsList({ adsData, adsLoading, adsError }));
        }
        if(!adsLoading && isLoadConfig && refetchApiCount?.isLoading && (API_NAME.ADS in refetchApiCount?.expected)){
            dispatch(setRefetchApiCountRan(API_NAME.ADS))
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [adsData, adsLoading, adsError]);

    // To add AMI information in MssqlEntities
    useEffect(() => {
        if (amiError) {
            dispatch(addAmiList({ undefined, amiLoading, amiError }));
        } else {
            dispatch(addAmiList({ amiData, amiLoading, amiError }));
            if(selectedConfig === SELECT_CONFIG.EASY_CREATE){
                const firstAmi = amiData?.amis[0];
                const amiVal = firstAmi?.imageId;
                const amiName = firstAmi?.name;
                const option = generateOptionType(amiVal, amiVal, amiName, false, '');
                dispatch(setSelectedLicenseId(option));
            }
        }
        if(!amiLoading && isLoadConfig && refetchApiCount?.isLoading && (API_NAME.AMI in refetchApiCount?.expected)){
            dispatch(setRefetchApiCountRan(API_NAME.AMI))
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [amiData, amiLoading, amiError]);

    // To add SNS information in MssqlEntities
    useEffect(() => {
        if (snsError) {
            dispatch(addSnsList({ undefined, snsLoading, snsError }));
        } else {
            dispatch(addSnsList({ snsData, snsLoading, snsError }));
        }
        if(!snsLoading && isLoadConfig && refetchApiCount?.isLoading && (API_NAME.SNS in refetchApiCount?.expected)){
            dispatch(setRefetchApiCountRan(API_NAME.SNS))
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [snsData, snsLoading, snsError]);

    // To add KMS Keys in MssqlEntities
    useEffect(() => {
        if (kmsError) {
            dispatch(addKmsKeysList({ undefined, kmsLoading, kmsError }));
        } else {
            const kmsData = formatKmsData(kmsList);
            dispatch(addKmsKeysList({ kmsData, kmsLoading, kmsError }));
            if(selectedConfig === SELECT_CONFIG.EASY_CREATE && kmsData && kmsData.length > 0){
                dispatch(setEncryptionRow([kmsData[0]]));
            }
        }
        if(!kmsLoading && isLoadConfig && refetchApiCount?.isLoading && (API_NAME.KMS in refetchApiCount?.expected)){
            dispatch(setRefetchApiCountRan(API_NAME.KMS))
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kmsList, kmsLoading, kmsError]);

    // To add Key Pair in MssqlEntities
    useEffect(() => {
        if (keyPairError) {
            dispatch(addKeyPairList({ undefined, keyPairLoading, keyPairError }));
        } else {
            dispatch(addKeyPairList({ keyPairData, keyPairLoading, keyPairError }));
            if(selectedConfig === SELECT_CONFIG.EASY_CREATE){
                const keyPaitFirst = keyPairData?.keyPairs[0];
                const keyPairName = keyPaitFirst?.name || '';
                const option = generateOptionType(keyPairName, keyPairName, '', false, '', keyPaitFirst);
                dispatch(setSelectedKeyPair(option));
            }
        }
        if(!keyPairLoading && isLoadConfig && refetchApiCount?.isLoading && (API_NAME.KEYPAIR in refetchApiCount?.expected)){
            dispatch(setRefetchApiCountRan(API_NAME.KEYPAIR))
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keyPairData, keyPairLoading, keyPairError]);

    // To add Instance Type in MssqlEntities
    useEffect(() => {
        if (instanceTypeError) {
            dispatch(addInstanceTypeList({ undefined, instanceTypeLoading, instanceTypeError }));
        } else {
            dispatch(addInstanceTypeList({ instanceTypeData, instanceTypeLoading, instanceTypeError }));
            if(selectedConfig === SELECT_CONFIG.EASY_CREATE && instanceTypeData && instanceTypeData?.instanceTypes.length > 0){
                const defaultInsType = instanceTypeData?.instanceTypes?.filter((instance: { instanceType: string; }) => 
                    instance.instanceType === DEAFULT_INSTANCE_VALUE);
                const firstInstanceName = (defaultInsType && defaultInsType.length > 0) ? defaultInsType[0] : instanceTypeData?.instanceTypes[0];
                const value = firstInstanceName?.instanceType || '';
                let label2 = '';
                if (firstInstanceName?.vCpus) {
                    label2 += firstInstanceName?.vCpus + 'vCPU, ';
                }
                if (firstInstanceName?.ramInMib) {
                    label2 += formatSize(firstInstanceName?.ramInMib, 'mib') + ' RAM, ';
                }
                if (firstInstanceName?.iopsInMbps) {
                    label2 += firstInstanceName?.iopsInMbps + 'Mbps';
                }
                const option = generateOptionType(value, value, label2, false, '', firstInstanceName);
                dispatch(setInstanceType(option));
            }
        }
        if(!instanceTypeLoading && isLoadConfig && refetchApiCount?.isLoading && (API_NAME.INSTANCE in refetchApiCount?.expected)){
            dispatch(setRefetchApiCountRan(API_NAME.INSTANCE))
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [instanceTypeData, instanceTypeLoading, instanceTypeError]);

    // To add FSxN in MssqlEntities
    useEffect(() => {
        const vpcId = selectedVpcData?.data ? selectedVpcData?.data?.id : undefined;
        if(!vpcId){
            dispatch(addFsxnList({ undefined, fsxnLoading, fsxnError }));
        } else {
            if (fsxnError) {
                dispatch(addFsxnList({ undefined, fsxnLoading, fsxnError }));
            } else {
                dispatch(addFsxnList({ fsxnData, fsxnLoading, fsxnError }));
            }
            if(!fsxnLoading && isLoadConfig && refetchApiCount?.isLoading && (API_NAME.FSXN in refetchApiCount?.expected)){
                dispatch(setRefetchApiCountRan(API_NAME.FSXN))
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fsxnData, fsxnLoading, fsxnError, selectedVpcData]);

    // To add saved configuration list
    useEffect(() => {
        if(configError) {
            dispatch(addSavedConfigList({undefined, configLoading, configError}));
        } else {
            dispatch(addSavedConfigList({configData, configLoading, configError}));
        }
        
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [configData, configLoading, configError]);

    return;
};

export default MssqlApis;
