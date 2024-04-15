import { useState, useEffect, useMemo } from 'react';
import {
    delay,
    formatSize,
    formatVpcSubnetsData,
    generateOptionType,
    getChatbotParamsFromPayload,
    getWlmdbPayload,
    wrapContext
} from '../../../utils/utilityFunctions';

import styles from './Chatbot.module.scss';
import ChatBox from './ChatBox/Chatbox';
import { useAppDispatch, useAppSelector } from '../../../store/storeHooks';
import { useDeploySqlTemplateMutation, useSendMsgMutation } from '../../../utils/apiService';
import {
    setCurrentIntent,
    setExpectingResponse,
    setIsWizardTouched,
    setLatestIntentMsg,
    setLoadConfigClicked,
    setMessages,
    setResumeCount,
    setShowRetry,
    setSuggestionBubbles
} from '../../../store/chatbot/chatbotSlice';
import {
    initialMssqlState,
    setCloudWatch,
    setDBCredentialsName,
    setDBCredentialsPassword,
    setDBName,
    setExistingFsxnName,
    setFsxNExistingUserName,
    setFsxNPassword,
    setFsxNType,
    setInstanceType,
    setMssqlForm,
    setSelectedADDomainAddress,
    setSelectedADDomainName,
    setSelectedADPassword,
    setSelectedADScenarioType,
    setSelectedADUserName,
    setSelectedAzNode1,
    setSelectedAzNode2,
    setSelectedCredentials,
    setSelectedDBDeploymentModel,
    setSelectedExistingSecurityGroup,
    setSelectedKeyPair,
    setSelectedLicenseId,
    setSelectedRegionData,
    setSelectedSecurityGroup,
    setSelectedSubnetNode1,
    setSelectedSubnetNode2,
    setSelectedVPC,
    setStorageCapacity,
    setStorageUnit,
    setTags,
    setThroughputValue
} from '../../../store/mssql/mssqlFormSlice';
import { CHATBOT, GENERAL } from '../../../utils/appConstants';
import {
    AWS_MANAGED_AD,
    CHATBOT_WELCOME_CARDS,
    FORM_TO_WLF_NAVIGATE,
    WLF_TABS,
    PRODUCTION,
    SQL_DEPLOYMENT_MODE,
    TIMELINE_PROD_LINK,
    TIMELINE_STAGE_LINK,
    USER_MANAGED_AD
} from '../../../utils/consts';
import ChatbotHeader from './ChatbotHeader/ChatbotHeader';
import { handleCreateSQLServer } from '../MSSqlServer/MSSqlFooter/createSqlServer';
import { setDeployRedirectToCfLink, setIsLoading } from '../../../store/mssql/msSqlActionSlice';
import { Button } from '@netapp/design-system';
import { NOTIFICATION_TYPES, addNotification, clearNotifications } from '../../../store/notificationSlice';
import { useNavigate } from 'react-router-dom';
import { navigateToCanvas } from '../../../utils/appConfig';
import MissingPermissionsMsg from '../AwsSettings/AwsAccount/MissingPermissionsMsg';
import store from '../../../store/store';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventorySlice';
import { setHeaderSelectedCred, setHeaderSelectedRegion } from '../../../store/workloadFactory/headersSlice';
const _ = require('lodash');

type optionsType = {
    value?: string | number;
    label?: string;
};

type messageType = {
    sender?: string;
    msg?: string;
    key?: string;
    list?: optionsType[];
    intent?: any;
    type?: string;
    active?: boolean;
    error?: any;
};

const Chatbot = () => {
    const { messages, currentIntent, isReceivingMsg, loadConfigClicked, showRetry, latestIntentMsg, resumeCount } =
        useAppSelector(state => state.chatbot);
    const mssqlFormData = useAppSelector(state => state.mssqlForm);
    const selectedCredential = useAppSelector(state => state.mssqlForm?.awsAccount?.selectedCredential);
    const selectedRegionData = useAppSelector(state => state.mssqlForm?.regionAndVpc?.selectedRegion);
    const mssqlData = useAppSelector(state => state.mssql);
    const state = useAppSelector(state => state);
    const [isBotReplying, setIsBotReplying] = useState(false);
    const [isPayloadReady, setIsPayloadReady] = useState(false);
    const [payloadContent, setPayloadContent] = useState<any>('');
    const [activeField, setActiveField] = useState<any>('');
    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    const [sendMsgToBot] = useSendMsgMutation();
    const [deploySqlTemplate] = useDeploySqlTemplateMutation();

    const handleKeyPress = async (e: any) => {
        await delay(0);
        const activeElement = document.activeElement;
        if (activeElement?.tagName === 'INPUT') {
            if (activeElement.getAttribute('id') && activeElement.getAttribute('id')?.includes('react-select')) {
                if (document?.activeElement?.parentElement?.parentElement?.parentElement) {
                    setActiveField(document.activeElement.parentElement.parentElement.parentElement.getAttribute('id'));
                }
            } else {
                setActiveField(activeElement.getAttribute('id'));
            }
        }
        if (activeElement?.tagName === 'BUTTON') {
            if (activeElement.getAttribute('id') === 'continue-button') {
                setActiveField('continue-button');
            }
        }
    };

    useEffect(() => {
        document.addEventListener('keydown', handleKeyPress);

        return () => {
            document.removeEventListener('keydown', handleKeyPress);
        };
    });

    useEffect(() => {
        if (isPayloadReady) {
            dispatch(
                setSuggestionBubbles({
                    list: [{ label: 'Deploy', value: 'deploy' }],
                    onBubbleClick: (label?: string, value?: string) => {
                        if (value === 'deploy') {
                            handleCreate();
                            dispatch(setExpectingResponse({ type: 'none', fieldname: '' }));
                        }
                    }
                })
            );
        }
    }, [isPayloadReady]);

    useEffect(() => {
        if (loadConfigClicked) {
            setIsBotReplying(true);
            sendMsgToBot({
                payload: {
                    prompt: wrapContext(
                        `DeployMsSql with params: ${JSON.stringify({
                            ...getChatbotParamsFromPayload(mssqlFormData),
                            deploymentEnvironment: 'CUSTOM'
                        })}`
                    ),
                    intent: 'DeployMsSql',
                    params: getChatbotParamsFromPayload(mssqlFormData)
                }
            })
                .then((res: any) => {
                    if (res.data) {
                        const { message, key, allowedValues, allowCreate, intent, type, error, status } = res.data;
                        if (intent) {
                            dispatch(setCurrentIntent(intent));
                            if (!intent.complete) {
                                setPayloadContent(getWlmdbPayload(intent.params));
                                mapParamsToPayload(intent.params);
                            } else {
                                setPayloadContent(intent.validatedJson);
                                mapParamsToPayload(intent.params);
                            }
                            setIsPayloadReady(intent.complete);
                            if (intent.complete) {
                                dispatch(setExpectingResponse({ type: 'none', fieldName: '' }));
                            }
                        }

                        const updatedMessages = [
                            {
                                sender: 'bot',
                                msg: message,
                                key: key,
                                list: allowedValues,
                                allowCreate: allowCreate,
                                intent: intent,
                                type: type,
                                active: true,
                                error: error,
                                status: status
                            }
                        ];

                        if (currentIntent && !intent) {
                            updatedMessages[updatedMessages.length - 3] = {
                                ...updatedMessages[updatedMessages.length - 3],
                                active: false
                            };
                        }

                        dispatch(setMessages(updatedMessages));
                    }
                    setIsBotReplying(false);
                    dispatch(setLoadConfigClicked(false));
                })
                .catch((error: any) => {
                    setIsBotReplying(false);
                    console.log('Error while fetching data - ', error);
                    dispatch(setLoadConfigClicked(false));
                });
        }
    }, [loadConfigClicked]);

    const fullPermissionFlow = (stackName: string, stackUrl: string) => {
        let notificationMsg: string | number | NodeJS.Timeout | undefined;
        // Just show notification in case of full permission and redirect to Homepage after 3 sec
        const isWorkloadFactoryStatus = state.auth?.isWorkloadFactory;
        if (stackName && stackName.includes('/')) {
            stackName = stackName.split('/')[1];
        }
        let message;
        if (isWorkloadFactoryStatus) {
            message = (
                <>
                    {GENERAL.CREATE_INFO_MESSAGE_WLM[0]}
                    {
                        <>
                            <Button
                                Component="button"
                                variant="text"
                                onClick={() => {
                                    clearTimeout(notificationMsg);
                                    dispatch(setSelectedHeaderTab(WLF_TABS.JOB_MONITORING));
                                    navigate('../databases');
                                    dispatch(clearNotifications());
                                }}
                            >
                                {GENERAL.CREATE_INFO_MESSAGE_WLM[1]}
                            </Button>
                        </>
                    }
                    {GENERAL.CREATE_INFO_MESSAGE_WLM[2]}
                </>
            );
        } else {
            const timelineUrl =
                process.env.REACT_APP_ENVIRONMENT === PRODUCTION ? TIMELINE_PROD_LINK : TIMELINE_STAGE_LINK;
            message = (
                <>
                    {GENERAL.CREATE_INFO_MESSAGE[0]}
                    {stackName && !stackUrl ? GENERAL.CREATE_INFO_MESSAGE[1] + stackName : ''}
                    {stackName && stackUrl && (
                        <>
                            {GENERAL.CREATE_INFO_MESSAGE[1]}
                            <Button
                                Component="button"
                                variant="link"
                                onClick={() => window.open(stackUrl, '_blank', 'noopener')}
                            >
                                {stackName}
                            </Button>
                        </>
                    )}
                    {GENERAL.CREATE_INFO_MESSAGE[2]}
                    <Button
                        Component="button"
                        variant="text"
                        onClick={() => window.open(timelineUrl, '_blank', 'noopener')}
                    >
                        {GENERAL.CREATE_INFO_MESSAGE[3]}
                    </Button>
                    {GENERAL.CREATE_INFO_MESSAGE[4]}
                </>
            );
        }
        dispatch(addNotification({ notificationType: NOTIFICATION_TYPES.INFO, message: message }));
        notificationMsg = setTimeout(() => {
            isWorkloadFactoryStatus ? navigate(FORM_TO_WLF_NAVIGATE) : navigateToCanvas('/');
        }, 3000);
    };

    const handleCreate = () => {
        const state = store.getState();
        const payload = handleCreateSQLServer(state, dispatch);
        const selectedCredId = state.mssqlForm.awsAccount.selectedCredential?.data?.credentialsId;
        const selectedRegionCode = state.mssqlForm.regionAndVpc.selectedRegion?.data?.regionCode;
        if (payload) {
            dispatch(setIsLoading(true));
            dispatch(setDeployRedirectToCfLink(null));
            deploySqlTemplate({ credentialId: selectedCredId, region: selectedRegionCode, payload: payload })
                .then((data: any) => {
                    dispatch(setIsLoading(false));
                    if (!data?.error) {
                        let stackName = data?.data?.cloudFormationStackId;
                        const url = data?.data?.cloudFormationUrl;
                        const warning = data?.data?.warningMessage;
                        if (stackName && !warning) {
                            // If stackname is present than goes to fullPermissionFlow
                            fullPermissionFlow(stackName, url);
                            let defaultParams = getChatbotParamsFromPayload(mssqlFormData);
                            let defaultObj: any = {};
                            Object.keys(defaultParams).map((key: string) => {
                                defaultObj[key] = null;
                            });
                            mapParamsToPayload(defaultObj);
                            dispatch(setCurrentIntent(''));
                            dispatch(setIsWizardTouched(false));
                            dispatch(setMessages([]));
                            dispatch(setSuggestionBubbles({ list: [], onBubbleClick: () => {} }));
                        } else if (url) {
                            dispatch(setDeployRedirectToCfLink(url));
                            // If url comes it means it has view permissions so it will open AWS account accordion
                            dispatch(setSuggestionBubbles({ list: [], onBubbleClick: () => {} }));
                            dispatch(
                                setMessages([
                                    ...messages,
                                    {
                                        sender: 'bot',
                                        msg: '',
                                        customComponent: <MissingPermissionsMsg />
                                    }
                                ])
                            );
                        }
                    }
                })
                .catch((error: any) => {
                    dispatch(setIsLoading(false));
                });
        }
    };

    useEffect(() => {
        const credValue = selectedCredential?.data?.name;
        if (credValue) {
            const label2 = `Account ID: ${selectedCredential?.data?.providerAccountId}`;
            const option = generateOptionType(credValue, credValue, label2, false, '', selectedCredential?.data);
            dispatch(setHeaderSelectedCred(option));
        }
    }, [selectedCredential]);

    useEffect(() => {
        const regionValue = selectedRegionData?.data?.regionName;
        if (regionValue) {
            const label2 = selectedRegionData?.data?.regionCode;
            const option = generateOptionType(regionValue, regionValue, label2, false, '', selectedRegionData?.data);
            dispatch(setHeaderSelectedRegion(option));
        }
    }, [selectedRegionData]);

    const mapParamsToPayload = (params: any) => {
        Object.keys(params).map(key => {
            const value = params[key];
            switch (key) {
                case 'credentialsId':
                    if (mssqlFormData?.awsAccount?.selectedCredential?.data?.credentialsId !== value) {
                        const selectedCredentialOption = mssqlData.getCredentials.credentialData?.filter(
                            item => item.credentialsId === value
                        )[0];
                        const credValue =
                            selectedCredentialOption?.name +
                            ' | Account: ' +
                            selectedCredentialOption?.providerAccountId;
                        const option = generateOptionType(
                            credValue,
                            credValue,
                            '',
                            false,
                            '',
                            selectedCredentialOption
                        );
                        dispatch(setSelectedCredentials(value ? option : null));
                    }
                    break;
                case 'sqlDeploymentMode':
                    if (
                        (mssqlFormData?.dbDeploymentModel?.value === 'fci' && value === 'standalone') ||
                        (mssqlFormData?.dbDeploymentModel?.value === 'standalone' && value === 'fci')
                    ) {
                        dispatch(
                            setSelectedDBDeploymentModel(
                                value === 'standalone'
                                    ? {
                                          label: GENERAL.SINGLE_INSTANCE,
                                          value: SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE
                                      }
                                    : {
                                          label: GENERAL.FAILOVER_CLUSTER,
                                          value: SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE
                                      }
                            )
                        );
                    }
                    break;
                case 'region':
                    if (mssqlFormData?.regionAndVpc?.selectedRegion?.data?.regionCode !== value) {
                        const selectedRegionOption = mssqlData.getRegions.regionsData?.regions?.filter(
                            item => item.regionCode === value
                        )[0];
                        const credValue =
                            selectedRegionOption?.regionCode + ' | Account: ' + selectedRegionOption?.regionName;
                        const option = generateOptionType(credValue, credValue, '', false, '', selectedRegionOption);
                        dispatch(setSelectedRegionData(value ? option : null));
                    }
                    break;
                case 'vpcId':
                    if (mssqlFormData?.regionAndVpc?.selectedVPC?.data?.id !== value) {
                        const selectedVpcId = mssqlData.getVPCList.vpcData?.vpcs?.filter(item => item.id === value)[0];
                        const vpcValue =
                            (selectedVpcId?.name ? selectedVpcId.name + ' | ' : '') +
                                (selectedVpcId?.cidrBlock ? selectedVpcId.cidrBlock[0]?.CidrBlock : '') || '-';
                        const vpcLabel2 = selectedVpcId?.id!;
                        const vpcData = {
                            id: selectedVpcId?.id,
                            name: selectedVpcId?.name,
                            cidrBlock: selectedVpcId?.cidrBlock ? selectedVpcId?.cidrBlock[0]?.CidrBlock : '',
                            availabilityZones: formatVpcSubnetsData(selectedVpcId || { subnets: [] })
                        };
                        const option = generateOptionType(vpcValue, vpcValue, vpcLabel2, false, '', vpcData);
                        dispatch(setSelectedVPC(value ? option : null));
                    }
                    break;
                case 'availabilityZone1':
                    if (mssqlFormData?.availabilityZones?.selectedAzNode1?.data?.availabilityZone !== value) {
                        const azData = mssqlFormData?.regionAndVpc?.selectedVPC?.data?.availabilityZones;
                        const zones = azData ? Object.keys(azData) : [];
                        const selectedAzNode1 = zones.filter(val => val === value)[0];
                        const subnetsList: Array<string> = [];
                        azData?.[selectedAzNode1]?.map((per: any) => (per?.id ? subnetsList.push(per.id) : ''));
                        const data: any = {
                            availabilityZone: selectedAzNode1,
                            subnets: subnetsList
                        };
                        const option: any = generateOptionType(selectedAzNode1, selectedAzNode1, '', false, '', data);
                        dispatch(setSelectedAzNode1(value ? option : null));
                    }
                    break;
                case 'privateSubnet1Id':
                    if (mssqlFormData?.availabilityZones?.selectedSubnetNode1?.value !== value) {
                        const subnetData = mssqlFormData?.regionAndVpc?.selectedVPC?.data?.availabilityZones?.[
                            params.availabilityZone1
                        ]?.filter((item: any) => item.id === value)[0];
                        const label2 = subnetData?.id;
                        const val = subnetData?.cidrBlock;
                        const option = generateOptionType(val, val, label2, false, '', subnetData);
                        dispatch(setSelectedSubnetNode1(value ? option : null));
                    }
                    break;
                case 'availabilityZone2':
                    if (mssqlFormData?.availabilityZones?.selectedAzNode2?.data?.availabilityZone !== value) {
                        const azData = mssqlFormData?.regionAndVpc?.selectedVPC?.data?.availabilityZones;
                        const zones = azData ? Object.keys(azData) : [];
                        const selectedAzNode2 = zones.filter(val => val === value)[0];
                        const subnetsList: Array<string> = [];
                        azData?.[selectedAzNode2]?.map((per: any) => (per?.id ? subnetsList.push(per.id) : ''));
                        const data: any = {
                            availabilityZone: selectedAzNode2,
                            subnets: subnetsList
                        };
                        const option: any = generateOptionType(selectedAzNode2, selectedAzNode2, '', false, '', data);
                        dispatch(setSelectedAzNode2(value ? option : null));
                    }
                    break;
                case 'privateSubnet2Id':
                    if (mssqlFormData?.availabilityZones?.selectedSubnetNode2?.value !== value) {
                        const subnetData = mssqlFormData?.regionAndVpc?.selectedVPC?.data?.availabilityZones?.[
                            params.availabilityZone2
                        ]?.filter((item: any) => item.id === value)[0];
                        const label2 = subnetData?.id;
                        const val = subnetData?.cidrBlock;
                        const option = generateOptionType(val, val, label2, false, '', subnetData);
                        dispatch(setSelectedSubnetNode2(value ? option : null));
                    }
                    break;
                case 'keyPairName':
                    if (mssqlFormData?.keyPair?.selectedKeyPair?.data?.name !== value) {
                        const selectedKayPair = mssqlData?.getKeyPairList?.keyPairData?.keyPairs?.filter(
                            item => item.name === value
                        )[0];
                        const keyPairName = selectedKayPair?.name || '';
                        const option = generateOptionType(keyPairName, keyPairName, '', false, '', selectedKayPair);
                        dispatch(setSelectedKeyPair(value ? option : null));
                    }
                    break;
                case 'workloadInstanceType':
                    if (mssqlFormData?.instanceType?.data?.instanceType !== value) {
                        const selectedInstance: any =
                            mssqlData?.getInstanceTypeList?.instanceTypeData?.instanceTypes?.filter(
                                item => item.instanceType === value
                            )[0];
                        let label2 = '';
                        if (selectedInstance?.vCpus) {
                            label2 += selectedInstance?.vCpus + 'vCPU, ';
                        }
                        if (selectedInstance?.ramInMib) {
                            label2 += formatSize(selectedInstance?.ramInMib, 'mib') + ' RAM, ';
                        }
                        if (selectedInstance?.iopsInMbps) {
                            label2 += selectedInstance?.iopsInMbps + 'Mbps';
                        }
                        const option = generateOptionType(value, value, label2, false, '', selectedInstance);
                        dispatch(setInstanceType(value ? option : null));
                    }
                    break;
                case 'domainUsername':
                    if (mssqlFormData?.activeDirectory?.userName !== value) {
                        dispatch(setSelectedADUserName(value || null));
                    }
                    break;
                case 'domainPassword':
                    if (mssqlFormData?.activeDirectory?.password !== value) {
                        dispatch(setSelectedADPassword(value || null));
                    }
                    break;
                case 'domainDnsname':
                    if (mssqlFormData?.activeDirectory?.domainName !== value) {
                        const selectedDomainName = mssqlData.getAdsList?.adsData?.directories?.filter(
                            item => item.domainName === value
                        )[0];
                        if (selectedDomainName) {
                            const verVal = selectedDomainName?.domainName;
                            const data = {
                                domainName: selectedDomainName?.domainName,
                                dnsIpAddress: (selectedDomainName?.dnsIpAddress || '').toString(),
                                securityGroupId: selectedDomainName?.vpcSettings?.securityGroupId,
                                adScenarioType: AWS_MANAGED_AD
                            };
                            const option = generateOptionType(verVal, verVal, '', false, '', data);
                            dispatch(setSelectedADDomainName(option));
                            dispatch(setSelectedADDomainAddress(data?.dnsIpAddress));
                            dispatch(setSelectedADScenarioType(AWS_MANAGED_AD));
                        } else {
                            const option = generateOptionType(value, value, '', false, '', {
                                domainName: value,
                                adScenarioType: USER_MANAGED_AD
                            });
                            dispatch(setSelectedADDomainName(value ? option : null));
                            dispatch(setSelectedADScenarioType(USER_MANAGED_AD));
                        }
                    }
                    break;
                case 'dnsIpaddress':
                    if (mssqlFormData?.activeDirectory?.domainAddress !== value) {
                        dispatch(setSelectedADDomainAddress(value || null));
                    }
                    break;
                case 'serviceAccountName':
                    if (mssqlFormData?.dbCredentials?.name !== value) {
                        dispatch(setDBCredentialsName(value || null));
                    }
                    break;
                case 'serviceAccountPassword':
                    if (mssqlFormData?.dbCredentials?.password !== value) {
                        dispatch(setDBCredentialsPassword(value || null));
                    }
                    break;
                case 'sqlAmiId':
                    if (mssqlFormData?.license?.selectedLicenseId?.value !== value) {
                        const selectedLicense = mssqlData.getAmiList?.amiData?.amis?.filter(
                            item => item.imageId === value
                        )[0];
                        const amiVal = selectedLicense?.imageId;
                        const amiName = selectedLicense?.name || '';
                        const data = {
                            architecture: selectedLicense?.architecture,
                            amiVal: selectedLicense?.imageId,
                            amiName: selectedLicense?.name
                        };
                        const option = generateOptionType(amiVal, amiVal, amiName, false, '', data);
                        dispatch(setSelectedLicenseId(value ? option : null));
                    }
                    break;
                case 'fsxFileSystemId':
                    dispatch(setFsxNType(GENERAL.SELECT_EXISTING_FSX));
                    if (mssqlFormData?.fsxN?.fsxNExistingName?.fileSystemId !== value) {
                        const selectedFsx = mssqlData?.getFsxnList?.fsxnData?.filesystems?.filter(
                            (item: any) => item.fileSystemId === value
                        )[0];
                        const val = (selectedFsx?.name ? selectedFsx.name + ' | ' : '') + selectedFsx?.fileSystemId;
                        const data = {
                            fileSystemId: selectedFsx?.fileSystemId,
                            fileSystemName: selectedFsx?.name,
                            securityGroups: selectedFsx?.securityGroups,
                            throughput: selectedFsx?.ontapConfiguration?.throughputCapacity,
                            iops: selectedFsx?.ontapConfiguration?.diskIopsConfiguration?.iops,
                            preferredSubnetId: selectedFsx?.ontapConfiguration?.preferredSubnetId,
                            kmsKeyId: selectedFsx?.kmsKeyId
                        };
                        const option = generateOptionType(val, val, '', false, '', data);
                        dispatch(setExistingFsxnName(value ? option : null));
                    }
                    break;
                case 'fsxUsername':
                    if (mssqlFormData?.fsxN?.fsxNNewUserName) {
                        dispatch(setFsxNExistingUserName(value || null));
                    }
                    break;
                case 'fsxPassword':
                    if (mssqlFormData?.fsxN?.fsxNPassword !== value) {
                        dispatch(setFsxNPassword(value || null));
                    }
                    break;
                case 'fsxVolThroughput':
                    const numVal = parseInt(value);
                    const convertedVal = numVal < 1024 ? `${numVal} MBps` : `${numVal / 1024} GBps`;
                    if (mssqlFormData?.throughput?.value !== convertedVal) {
                        const option = generateOptionType(convertedVal, convertedVal, '', false, '');
                        dispatch(setThroughputValue(value ? option : null));
                    }
                    break;
                case 'databaseSize':
                    const convertToGb =
                        mssqlFormData?.storageCapacity?.unit?.value === 'TiB'
                            ? parseInt(mssqlFormData?.storageCapacity?.capacity) * 1024
                            : parseInt(mssqlFormData?.storageCapacity?.capacity);
                    if (convertToGb !== value) {
                        dispatch(setStorageCapacity(value));
                        const option = generateOptionType('GiB', 'GiB', '', false, '');
                        dispatch(setStorageUnit(value ? option : null));
                    }
                    break;
                case 'ontapSgGroupId':
                    if (mssqlFormData?.securityGroup?.sgValue !== value) {
                        const selectedVpcId = mssqlFormData?.regionAndVpc?.selectedVPC?.data?.id;
                        if (selectedVpcId) {
                            const selectedSg: any = mssqlData?.getSGList?.sgData?.securityGroups?.filter(
                                (item: any) => item?.id === value
                            )[0];
                            const sgValue = selectedSg?.id;
                            const sgLabel = selectedSg?.securityGroupName || selectedSg?.name || '-';
                            const option = generateOptionType(sgValue, sgValue, sgLabel, false, '');
                            dispatch(
                                setSelectedSecurityGroup(
                                    value ? GENERAL.USE_AN_EXISTING_SECURITY : GENERAL.GENERATED_SECURITY_GROUP
                                )
                            );
                            dispatch(setSelectedExistingSecurityGroup(value ? option : null));
                        }
                    }
                    break;
                case 'sqlServerName':
                    if (mssqlFormData?.dbName !== value) {
                        dispatch(setDBName(value || null));
                    }
                    break;
                case 'enableCloudWatch':
                    if (mssqlFormData.cloudWatch !== value) {
                        dispatch(setCloudWatch(value || true));
                    }
                    break;
                case 'tags':
                    if (!_.isEqual(mssqlFormData?.tags, value)) {
                        dispatch(setTags(value || []));
                    }
                    break;
            }
        });
    };

    const sendMsg = async (
        msg?: string,
        add: boolean = true,
        msgs = messages,
        paramObject: { [x: string]: { label: string; value: string } } = {}
    ) => {
        setIsBotReplying(true);
        let updatedMessages = msgs ? [...msgs] : [];
        if (add) {
            let preResponseMsg = msgs || [];
            if (preResponseMsg.length && preResponseMsg[preResponseMsg.length - 1].error) {
                const lastMsg = preResponseMsg[preResponseMsg.length - 1];
                preResponseMsg = [
                    ...preResponseMsg.slice(0, preResponseMsg.length - 1),
                    {
                        ...lastMsg,
                        active: false
                    }
                ];
            }
            dispatch(setMessages([...preResponseMsg, { sender: 'user', msg: msg }]));
            updatedMessages = [...updatedMessages, { sender: 'user', msg: msg }];
        }

        const data = Object.entries(paramObject).reduce((acc: { [x: string]: string }, [key, obj]) => {
            acc[key as string] = obj.value as string;
            return acc;
        }, {});

        sendMsgToBot({
            payload: {
                ...(msg && {
                    prompt:
                        (currentIntent?.type
                            ? wrapContext(
                                  `${currentIntent.type} with params ${JSON.stringify({
                                      ...currentIntent.params
                                  })}`
                              ) + 'Sure!'
                            : '') + wrapContext(msg)
                }),
                ...(currentIntent && {
                    intent: currentIntent?.type,
                    params: {
                        ...currentIntent?.params,
                        ...data
                    },
                    userParams: currentIntent?.userParams
                })
            }
        })
            .then((res: any) => {
                if (res.data) {
                    const { message, key, allowedValues, allowCreate, intent, type, error, status } = res.data;
                    if (intent) {
                        dispatch(setCurrentIntent(intent));
                        if (!intent.complete) {
                            setPayloadContent(getWlmdbPayload(intent.params));
                            mapParamsToPayload(intent.params);
                        } else {
                            setPayloadContent(intent.validatedJson);
                            mapParamsToPayload(intent.params);
                        }
                        setIsPayloadReady(intent.complete);
                        if (intent.complete) {
                            dispatch(setExpectingResponse({ type: 'none', fieldName: '' }));
                        }
                    }

                    updatedMessages = [
                        ...updatedMessages,
                        {
                            sender: 'bot',
                            msg: message,
                            key: key,
                            list: allowedValues,
                            allowCreate: allowCreate,
                            intent: intent,
                            type: type,
                            active: true,
                            error: error,
                            status: status
                        }
                    ];

                    if (currentIntent && !intent) {
                        updatedMessages[updatedMessages.length - 3] = {
                            ...updatedMessages[updatedMessages.length - 3],
                            active: false
                        };
                    } else {
                        dispatch(setResumeCount(0));
                    }

                    dispatch(setMessages(updatedMessages));
                    setIsBotReplying(false);
                }
            })
            .catch((error: any) => {
                setIsBotReplying(false);
                console.log('Error while fetching data - ', error);
            });
    };

    const setContext = () => {
        setIsBotReplying(true);
        sendMsgToBot({
            payload: {
                prompt: wrapContext(
                    `DeployMsSql with params: ${JSON.stringify({
                        ...getChatbotParamsFromPayload(mssqlFormData),
                        deploymentEnvironment: 'CUSTOM'
                    })}`
                ),
                intent: 'DeployMsSql',
                params: {
                    ...getChatbotParamsFromPayload(mssqlFormData),
                    deploymentEnvironment: 'CUSTOM'
                }
            }
        })
            .then((res: any) => {
                if (res.data) {
                    const { message, key, allowedValues, allowCreate, intent, type, error, status } = res.data;
                    if (intent) {
                        dispatch(setCurrentIntent(intent));
                        if (!intent.complete) {
                            setPayloadContent(getWlmdbPayload(intent.params));
                            mapParamsToPayload(intent.params);
                        } else {
                            setPayloadContent(intent.validatedJson);
                            mapParamsToPayload(intent.params);
                        }
                        setIsPayloadReady(intent.complete);
                        if (intent.complete) {
                            dispatch(setExpectingResponse({ type: 'none', fieldName: '' }));
                        }
                    }

                    const updatedMessages = [
                        {
                            sender: 'bot',
                            msg: message,
                            key: key,
                            list: allowedValues,
                            allowCreate: allowCreate,
                            intent: intent,
                            type: type,
                            active: true,
                            error: error,
                            status: status
                        }
                    ];

                    if (currentIntent && !intent) {
                        updatedMessages[updatedMessages.length - 3] = {
                            ...updatedMessages[updatedMessages.length - 3],
                            active: false
                        };
                    }

                    dispatch(setMessages(updatedMessages));
                    setIsBotReplying(false);
                }
            })
            .catch((error: any) => {
                setIsBotReplying(false);
                console.log('Error while fetching data - ', error);
            });
    };

    const handleSendMsg = async (msg: string, add: boolean = true, msgs: messageType[], paramObject = {}) => {
        await sendMsg(msg, add, msgs, paramObject);
    };

    const handleSelectButtonClicked = async (paramObj: any, sender: string = 'user') => {
        const updatedMessages = messages ? [...messages] : [];
        if (updatedMessages.length) {
            updatedMessages[updatedMessages.length - 1] = {
                ...updatedMessages[updatedMessages.length - 1],
                error: null,
                msg:
                    updatedMessages[updatedMessages.length - 1]?.error?.message ||
                    updatedMessages[updatedMessages.length - 1].msg
            };
        }
        updatedMessages.push({
            sender: sender,
            msg: paramObj[Object.keys(paramObj)[0]].label
        });
        dispatch(setMessages(updatedMessages));
        const msgToBot = Object.keys(paramObj)
            .map(key => `Use ${key} as ${typeof paramObj[key] === 'object' ? paramObj[key].value : paramObj[key]}`)
            .join(', ');
        dispatch(setLatestIntentMsg(msgToBot));
        await handleSendMsg('', false, updatedMessages, paramObj);
    };

    useEffect(() => {
        if (currentIntent && currentIntent.type === 'DeployMsSql' && !payloadContent) {
            setPayloadContent(getWlmdbPayload({}));
        }
        if (!currentIntent) {
            setPayloadContent('');
        }
    }, [currentIntent, payloadContent]);

    useEffect(() => {
        var objDiv = document.getElementById('chat_id');
        if (objDiv) {
            objDiv.scrollTop = objDiv.scrollHeight;
        }
    }, [messages]);
    //@ts-ignore
    const messagesToShow = useMemo(() => {
        const lastMsg = messages ? messages[messages.length - 1] : {};
        const updatedMsgs = messages
            ? messages.map((msg: any, idx: number) => {
                  return { ...msg, active: idx < messages.length - 1 ? false : msg.active };
              })
            : null;
        if (showRetry) {
            const existingMessages = updatedMsgs ? updatedMsgs : [];
            if (showRetry) {
                setIsBotReplying(false);
            }
            return [
                ...existingMessages,
                {
                    sender: 'bot',
                    type: 'confirm',
                    active: true,
                    msg: `Error getting response. Do you want to retry?`,
                    confirmData: {
                        confirmMsg: `Error getting response. Do you want to retry?`,
                        confirmBtnTxt: 'Yes',
                        cancelBtnTxt: 'No',
                        onConfirm: async (messages: messageType[]) => {
                            dispatch(setShowRetry(false));
                            const lastUserMsg = messages.filter(item => item.sender === 'user').reverse()?.[0];
                            dispatch(
                                setMessages([
                                    ...messages,
                                    {
                                        sender: 'bot',
                                        msg: 'Error getting response. Do you want to retry?'
                                    },
                                    {
                                        sender: 'user',
                                        msg: 'Yes'
                                    }
                                ])
                            );
                            if (lastUserMsg) {
                                await sendMsg(lastUserMsg.msg, existingMessages);
                            } else {
                                setContext();
                            }
                        },
                        onCancel: () => {
                            dispatch(setShowRetry(false));
                            dispatch(
                                setMessages([
                                    ...messages,
                                    {
                                        sender: 'bot',
                                        msg: 'Error getting response. Do you want to retry?'
                                    },
                                    {
                                        sender: 'user',
                                        msg: 'Yes'
                                    }
                                ])
                            );
                            dispatch(setCurrentIntent(''));
                        }
                    }
                }
            ];
        } else if (
            lastMsg &&
            lastMsg.sender === 'bot' &&
            !lastMsg.intent &&
            currentIntent &&
            currentIntent.type === 'DeployMsSql' &&
            lastMsg.type !== 'confirm' &&
            !(lastMsg?.status === 'error') &&
            resumeCount < 3 &&
            lastMsg.msg !== CHATBOT.WELCOME_PAGE.RESUME_DEPLOYMENT_MSG
        ) {
            dispatch(
                setSuggestionBubbles({
                    list: [{ label: 'Resume deployment', value: 'resume' }],
                    onBubbleClick: async (label?: string, value?: string) => {
                        dispatch(
                            setSuggestionBubbles({
                                list: [],
                                onBubbleClick: () => {}
                            })
                        );
                        if (value === 'resume') {
                            await sendMsg(latestIntentMsg, false);
                        }
                    }
                })
            );
            dispatch(setResumeCount(resumeCount + 1));
            return updatedMsgs;
            // const existingMessages = updatedMsgs ? updatedMsgs : [];
            // return [
            //     ...existingMessages,
            //     {
            //         sender: 'bot',
            //         type: 'confirm',
            //         active: true,
            //         msg: 'Deployment of MS SQL is in progress. Do you want to continue?',
            //         confirmData: {
            //             confirmMsg: 'Deployment of MS SQL is in progress. Do you want to continue?',
            //             confirmBtnTxt: 'Continue',
            //             cancelBtnTxt: 'Discard',
            //             onConfirm: (messages: messageType[]) => {
            // const botMsgs = messages.filter(item => item.sender === 'bot');
            // const lastIntentMsg = botMsgs.filter(msg => msg.intent).reverse()?.[0] || {};
            // const updatedMsgs = [...messages];
            // dispatch(setMessages([...updatedMsgs, { ...lastIntentMsg, active: true }]));
            //             },
            //             onCancel: () => {
            //                 dispatch(setCurrentIntent(''));
            //             }
            //         }
            //     }
            // ];
        } else if (lastMsg?.status === 'error') {
            dispatch(
                setSuggestionBubbles({
                    list: [
                        { label: 'Please give me examples for a valid request', value: 'suggestions' },
                        { label: 'Resume deployment', value: 'resume' }
                    ],
                    onBubbleClick: async (label?: string, value?: string) => {
                        if (value === 'suggestions') {
                            dispatch(
                                setSuggestionBubbles({
                                    list: CHATBOT_WELCOME_CARDS.map(item => {
                                        return { label: item.label, value: item.value || item.label };
                                    }),
                                    onBubbleClick: async (label?: string, value?: string) => {
                                        dispatch(
                                            setSuggestionBubbles({
                                                list: [],
                                                onBubbleClick: () => {}
                                            })
                                        );
                                        await sendMsg(value);
                                    }
                                })
                            );
                        }
                        if (value === 'resume') {
                            await sendMsg(latestIntentMsg, false);
                            dispatch(
                                setSuggestionBubbles({
                                    list: [],
                                    onBubbleClick: () => {}
                                })
                            );
                        }
                    }
                })
            );
            return updatedMsgs;
        } else {
            return updatedMsgs;
        }
    }, [messages, currentIntent, showRetry]);

    return (
        <div className={styles['chatbot']}>
            <div className={styles['page-content']}>
                <ChatbotHeader mapParamsToPayload={mapParamsToPayload} />
                <ChatBox
                    isBotReplying={isBotReplying || isReceivingMsg}
                    handleSelectButtonClicked={(paramObj: any, sender?: string) =>
                        handleSelectButtonClicked(paramObj, sender)
                    }
                    sendMsg={sendMsg}
                    messagesToShow={messagesToShow ? messagesToShow : []}
                    messages={messages ? messages : []}
                    activeField={activeField}
                    setContext={setContext}
                    mapParamsToPayload={mapParamsToPayload}
                />
            </div>
        </div>
    );
};

export default Chatbot;
