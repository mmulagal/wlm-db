import { useAppDispatch, useAppSelector } from '../../../store/storeHooks';
import {
    useGetAdsListQuery,
    useGetAmiListQuery,
    useGetConfigListQuery,
    useGetCredentialsQuery,
    useGetCustomAmiListQuery,
    useGetFsxnListQuery,
    useGetInstanceTypesQuery,
    useGetKeyPairsQuery,
    useGetKmsKeysQuery,
    useGetRegionsQuery,
    useGetSGListQuery,
    useGetSnsTopicsQuery,
    useGetSqlServerCollationListQuery,
    useGetThroughputRegionListQuery,
    useGetVPCListQuery,
    useGetWlmdbPoliciesQuery
} from '../../../utils/apiService';
import {
    addAdsList,
    addAmiList,
    addCredentials,
    addCustomAmiList,
    addFsxnList,
    addGetCollationList,
    addInstanceTypeList,
    addKeyPairList,
    addKmsKeysList,
    addPolicies,
    addRegions,
    addSGList,
    addSavedConfigList,
    addSnsList,
    addVpcList,
    getThroughputRegionList
} from '../../../store/mssql/mssqlSlice';
import { useEffect, useState } from 'react';

import { API_NAME, AWS_ASSUME_ROLE, DATABASE_TYPE, OS_TYPE, VPC_API_FIELDS } from '../../../utils/consts';
import { formatKmsData } from '../../../utils/utilityFunctions';
import { SELECT_CONFIG } from '../../../utils/appConstants';
import { setRefetchApiCountRan } from '../../../store/mssql/msSqlActionSlice';
import {
    selectDefaultCollation,
    selectDefaultEncryption,
    selectDefaultInstanceType,
    selectDefaultLicense
} from './MSSqlUtils';
import { setIsReceivingMsg } from '../../../store/chatbot/chatbotSlice';

const MssqlApis = () => {
    const dispatch = useAppDispatch();
    const selectedConfig = useAppSelector(state => state.mssqlForm.selectConfig);
    const isShowChatbot = useAppSelector(state => state.chatbot.isShow);

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

    // collationApiSkip to skip collation API when os version is not defined
    const [collationApiSkip, setCollationApiSkip] = useState(true);

    // fsxnSkip to skip FSxN API call when credentialId, regionCode, vpcId is not defined
    const [vpcDependentApiSkip, setVpcDependentApiSkip] = useState(true);

    //Getting the Data from state
    const selectedCredentialData = useAppSelector(state => state.mssqlForm.awsAccount.selectedCredential);
    const selectedRegionData = useAppSelector(state => state.mssqlForm.regionAndVpc.selectedRegion);
    const selectedVpcData = useAppSelector(state => state.mssqlForm.regionAndVpc.selectedVPC);
    const osVersion = useAppSelector(state => state.mssqlForm.operatingSystem);
    const dbEdition = useAppSelector(state => state.mssqlForm.dbEdition);
    const dbVersion = useAppSelector(state => state.mssqlForm.dbVersion);
    const isLoadConfig = useAppSelector(state => state.msSqlAction.isLoadConfig);
    const refetchApiCount = useAppSelector(state => state.msSqlAction.refetchApiCount);

    const { data: policiesList, isFetching: policiesLoading, isError: policiesError } = useGetWlmdbPoliciesQuery({});

    const {
        data: throughputRegionList,
        isFetching: throughputRegionListLoading,
        isError: throughputRegionListError
    } = useGetThroughputRegionListQuery({});

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

    // API call to get VPC list for selected credentials and region
    const {
        data: sgData,
        isFetching: sgLoading,
        isError: sgError
    } = useGetSGListQuery(
        { credentialId: selectedCredId, region: selectedRegionCode, vpcId: selectedVpcId },
        {
            skip: vpcDependentApiSkip
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
            databaseVersion: dbVersion?.value,
            filterAmis: !isShowChatbot
        },
        {
            skip: osVersion?.value === '2022' && dbVersion?.value === '2016' ? true : licenseAmiSkip
        }
    );

    // API call to get AMIs list for selected credentials and region
    const {
        data: customAmiData,
        isFetching: customAmiLoading,
        isError: customAmiError
    } = useGetCustomAmiListQuery(
        {
            credentialId: selectedCredId,
            region: selectedRegionCode
        },
        {
            skip: credAndRegionSkip
        }
    );

    // API call to get collation list for selected database version
    const {
        data: collationList,
        isFetching: collationListLoading,
        isError: collationListError
    } = useGetSqlServerCollationListQuery(
        { databaseVersion: dbVersion?.value },
        {
            skip: collationApiSkip
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
            skip: vpcDependentApiSkip
        }
    );

    // API call to get saved configuration list
    const { data: configData, isFetching: configLoading, isError: configError } = useGetConfigListQuery({});

    // To add policies information in MssqlEntities
    useEffect(() => {
        dispatch(addPolicies({ policiesList, policiesLoading, policiesError }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [policiesList, policiesLoading, policiesError]);

    // To get Throughput region list
    useEffect(() => {
        dispatch(
            getThroughputRegionList({ throughputRegionList, throughputRegionListLoading, throughputRegionListError })
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [throughputRegionList, throughputRegionListLoading, throughputRegionListError]);

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
        if (
            regionCode &&
            credId &&
            osVersion?.value &&
            dbEdition?.value &&
            dbVersion?.value &&
            !(osVersion?.value === '2022' && dbVersion?.value === '2016')
        ) {
            setLicenseAmiSkip(false);
        } else {
            setLicenseAmiSkip(true);
        }
        if (dbVersion?.value) {
            setCollationApiSkip(false);
        } else {
            setCollationApiSkip(true);
        }
        if (vpcId && regionCode && credId) {
            setVpcDependentApiSkip(false);
        } else {
            setVpcDependentApiSkip(true);
        }
    }, [selectedCredentialData, selectedRegionData, selectedVpcData, osVersion, dbEdition, dbVersion]);

    // To add credentials information in MssqlEntities
    useEffect(() => {
        if (regionsError) {
            dispatch(addRegions({ undefined, regionsLoading, regionsError }));
        } else {
            dispatch(addRegions({ regionsData, regionsLoading, regionsError }));
        }
        if (
            !regionsLoading &&
            isLoadConfig &&
            refetchApiCount?.isLoading &&
            refetchApiCount?.expected.includes(API_NAME.REGION)
        ) {
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
        if (
            !vpcLoading &&
            isLoadConfig &&
            refetchApiCount?.isLoading &&
            refetchApiCount?.expected.includes(API_NAME.VPC)
        ) {
            dispatch(setRefetchApiCountRan(API_NAME.VPC));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vpcData, vpcLoading, vpcError]);

    // To add VPC information in MssqlEntities
    useEffect(() => {
        if (sgError) {
            dispatch(addSGList({ undefined, sgLoading, sgError }));
        } else {
            dispatch(addSGList({ sgData, sgLoading, sgError }));
        }
        if (
            !sgLoading &&
            isLoadConfig &&
            refetchApiCount?.isLoading &&
            refetchApiCount?.expected.includes(API_NAME.SG)
        ) {
            dispatch(setRefetchApiCountRan(API_NAME.SG));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sgData, sgLoading, sgError]);

    // To add Ads information in MssqlEntities
    useEffect(() => {
        if (adsError) {
            dispatch(addAdsList({ undefined, adsLoading, adsError }));
        } else {
            dispatch(addAdsList({ adsData, adsLoading, adsError }));
        }
        if (
            !adsLoading &&
            isLoadConfig &&
            refetchApiCount?.isLoading &&
            refetchApiCount?.expected.includes(API_NAME.ADS)
        ) {
            dispatch(setRefetchApiCountRan(API_NAME.ADS));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [adsData, adsLoading, adsError]);

    // To add AMI information in MssqlEntities
    useEffect(() => {
        if (amiError) {
            dispatch(addAmiList({ undefined, amiLoading, amiError }));
        } else {
            dispatch(addAmiList({ amiData, amiLoading, amiError }));
            if (selectedConfig === SELECT_CONFIG.EASY_CREATE) {
                selectDefaultLicense(amiData, dispatch);
            }
        }
        if (
            !amiLoading &&
            isLoadConfig &&
            refetchApiCount?.isLoading &&
            refetchApiCount?.expected.includes(API_NAME.AMI)
        ) {
            dispatch(setRefetchApiCountRan(API_NAME.AMI));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [amiData, amiLoading, amiError]);

    // To add CustomAMI information in MssqlEntities
    useEffect(() => {
        if (customAmiError) {
            dispatch(addCustomAmiList({ undefined, customAmiLoading, customAmiError }));
        } else {
            dispatch(addCustomAmiList({ customAmiData, customAmiLoading, customAmiError }));
        }
        if (
            !customAmiLoading &&
            isLoadConfig &&
            refetchApiCount?.isLoading &&
            refetchApiCount?.expected.includes(API_NAME.CUSTOM_AMI)
        ) {
            dispatch(setRefetchApiCountRan(API_NAME.CUSTOM_AMI));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customAmiData, customAmiLoading, customAmiError]);

    useEffect(() => {
        if (collationListError) {
            dispatch(addGetCollationList({ undefined, collationListLoading, collationListError }));
        } else {
            dispatch(addGetCollationList({ collationList, collationListLoading, collationListError }));
            if (selectedConfig === SELECT_CONFIG.EASY_CREATE) {
                selectDefaultCollation(collationList, dispatch);
            }
        }
        if (
            !collationListLoading &&
            isLoadConfig &&
            refetchApiCount?.isLoading &&
            refetchApiCount?.expected.includes(API_NAME.COLLATION)
        ) {
            dispatch(setRefetchApiCountRan(API_NAME.COLLATION));
        }
    }, [collationList, collationListLoading, collationListError]);

    // To add SNS information in MssqlEntities
    useEffect(() => {
        if (snsError) {
            dispatch(addSnsList({ undefined, snsLoading, snsError }));
        } else {
            dispatch(addSnsList({ snsData, snsLoading, snsError }));
        }
        if (
            !snsLoading &&
            isLoadConfig &&
            refetchApiCount?.isLoading &&
            refetchApiCount?.expected.includes(API_NAME.SNS)
        ) {
            dispatch(setRefetchApiCountRan(API_NAME.SNS));
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
            if (selectedConfig === SELECT_CONFIG.EASY_CREATE) {
                selectDefaultEncryption(kmsData, dispatch);
            }
        }
        if (
            !kmsLoading &&
            isLoadConfig &&
            refetchApiCount?.isLoading &&
            refetchApiCount?.expected.includes(API_NAME.KMS)
        ) {
            dispatch(setRefetchApiCountRan(API_NAME.KMS));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kmsList, kmsLoading, kmsError]);

    // To add Key Pair in MssqlEntities
    useEffect(() => {
        if (keyPairError) {
            dispatch(addKeyPairList({ undefined, keyPairLoading, keyPairError }));
        } else {
            dispatch(addKeyPairList({ keyPairData, keyPairLoading, keyPairError }));
        }
        if (
            !keyPairLoading &&
            isLoadConfig &&
            refetchApiCount?.isLoading &&
            refetchApiCount?.expected.includes(API_NAME.KEYPAIR)
        ) {
            dispatch(setRefetchApiCountRan(API_NAME.KEYPAIR));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keyPairData, keyPairLoading, keyPairError]);

    // To add Instance Type in MssqlEntities
    useEffect(() => {
        if (instanceTypeError) {
            dispatch(addInstanceTypeList({ undefined, instanceTypeLoading, instanceTypeError }));
        } else {
            dispatch(addInstanceTypeList({ instanceTypeData, instanceTypeLoading, instanceTypeError }));
            if (selectedConfig === SELECT_CONFIG.EASY_CREATE) {
                selectDefaultInstanceType(instanceTypeData, dispatch);
            }
        }
        if (
            !instanceTypeLoading &&
            isLoadConfig &&
            refetchApiCount?.isLoading &&
            refetchApiCount?.expected.includes(API_NAME.INSTANCE)
        ) {
            dispatch(setRefetchApiCountRan(API_NAME.INSTANCE));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [instanceTypeData, instanceTypeLoading, instanceTypeError]);

    // To add FSxN in MssqlEntities
    useEffect(() => {
        const vpcId = selectedVpcData?.data ? selectedVpcData?.data?.id : undefined;
        if (!vpcId) {
            dispatch(addFsxnList({ undefined, fsxnLoading, fsxnError }));
        } else {
            if (fsxnError) {
                dispatch(addFsxnList({ undefined, fsxnLoading, fsxnError }));
            } else {
                dispatch(addFsxnList({ fsxnData, fsxnLoading, fsxnError }));
            }
            if (
                !fsxnLoading &&
                isLoadConfig &&
                refetchApiCount?.isLoading &&
                refetchApiCount?.expected.includes(API_NAME.FSXN)
            ) {
                dispatch(setRefetchApiCountRan(API_NAME.FSXN));
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fsxnData, fsxnLoading, fsxnError, selectedVpcData]);

    // To add saved configuration list
    useEffect(() => {
        if (configError) {
            dispatch(addSavedConfigList({ undefined, configLoading, configError }));
        } else {
            dispatch(addSavedConfigList({ configData, configLoading, configError }));
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [configData, configLoading, configError]);

    //To update chatbot msg loading status
    useEffect(() => {
        dispatch(setIsReceivingMsg(vpcLoading));
    }, [vpcLoading]);

    return;
};

export default MssqlApis;
