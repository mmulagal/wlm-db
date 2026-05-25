import { useState, useMemo, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import {
    AccordionCard,
    AccordionCardContent,
    PasswordField,
    RadioButton,
    TextField,
    DsTypography
} from '@netapp/design-system';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import { ReactComponent as WarningIcon } from '@netapp/icons/ic_notice_triangle.svg';
import { useTranslation } from 'react-i18next';
import ActionRequired from '../../../../common/ActionRequired/ActionRequired';
import { GENERAL } from '../../../../utils/appConstants';
import {
    fsxPassVal,
    generateOptionType,
    isFsxnExisting,
    isFsxnNew,
    sortListOfDict
} from '../../../../utils/utilityFunctions';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';
import { useAppSelector } from '../../../../store/storeHooks';
import {
    setExistingFsxnName,
    setFsxNPassword,
    setFsxNSsmArn,
    setFsxNType,
    setFsxNExistingUserName
} from '../../../../store/mssql/mssqlFormSlice';
import { FORM_OPTIONS, FSXADMIN, FSX_DEPLOYMENT_MODE, isValidSsmArn, WIZARD_TYPE } from '../../../../utils/consts';
import AccordionError from '../../../../common/AccordionError/AccordionError';

import styles from './FSxNSystem.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { setIsWizardTouched } from '../../../../store/chatbot/chatbotSlice';

const FSxNSystem = ({ wizardType }: any) => {
    const dispatch = useDispatch();
    const { t } = useTranslation();

    const isGovAccount = useAppSelector(state => state.auth.isGovAccount);
    const fsxSsmParameterArn = useAppSelector(state => state.mssqlForm.fsxN.ssmParameterArn);
    const { fsxnData, fsxnLoading } = useAppSelector(state => state.mssql.getFsxnList);
    const { credentialData } = useAppSelector(state => state.mssql.getCredentials);
    const selectedFsxnType = useAppSelector(state => state.mssqlForm.fsxN.fsxNType);
    const selectedFsxnNewUserName = useAppSelector(state => state.mssqlForm.fsxN.fsxNNewUserName);
    const selectedFsxnExistingUserName = useAppSelector(state => state.mssqlForm.fsxN.fsxNExistingUserName);
    const selectedFsxnPassword = useAppSelector(state => state.mssqlForm.fsxN.fsxNPassword);

    const selectedExistingFsxnName = useAppSelector(state => state.mssqlForm.fsxN.fsxNExistingName);
    const selectedVPCData = useAppSelector(state => state.mssqlForm.regionAndVpc.selectedVPC);
    const selectedZone1 = useAppSelector(state => state.mssqlForm.availabilityZones.selectedAzNode1);
    const selectedZone2 = useAppSelector(state => state.mssqlForm.availabilityZones.selectedAzNode2);

    const isFsxNotFilled = useAppSelector(state => state.msSqlAction.fsxNNameSelected);
    const isCreateHit = useAppSelector(state => state.msSqlAction.isCreateHit);
    const isLoadConfig = useAppSelector(state => state.msSqlAction.isLoadConfig);
    const deploymentMode = useAppSelector(state => state.mssqlForm.dbDeploymentModel);
    const isDemoMode = useAppSelector(state => state.auth.isDemoMode);
    const { movingFromChatbot } = useAppSelector(state => state.chatbot);

    const [password, setPassword] = useState('');

    const fsxNameRef = useRef(null);

    const fsxCheck = (fsxId: any) => {
        if (isDemoMode) {
            return '';
        }
        const selectedFsx = fsxnData?.filesystems?.filter((perRow: any) => perRow?.fileSystemId === fsxId);
        let val: any = {};
        if (selectedFsx && selectedFsx.length === 1) {
            val = selectedFsx[0];
        }
        const svmCount = val?.storageVirtualMachines ? val.storageVirtualMachines.length : 0;
        const throughputCapacity = val?.ontapConfiguration?.throughputCapacity || 0;
        const fsxType = val?.ontapConfiguration?.deploymentType;
        const lifecycle = val?.lifecycle;
        const fsxSubnets = val?.subnetIds || [];
        const node1SubnetsList = selectedZone1?.data?.subnets || [];
        const node2SubnetsList = selectedZone2?.data?.subnets || [];
        const primarySubnet = val?.ontapConfiguration?.preferredSubnetId;

        if (lifecycle && lifecycle === 'AVAILABLE') {
            let svmCheck = false;
            let expectedSvmCount = 0;
            if (throughputCapacity === 128 || throughputCapacity === 256) {
                // Added this check for PGSQL HA
                if (wizardType === WIZARD_TYPE.PGSQL && deploymentMode?.label === GENERAL.FAILOVER_CLUSTER) {
                    svmCheck = svmCount < 5;
                    expectedSvmCount = 5;
                } else {
                    svmCheck = svmCount < 6;
                    expectedSvmCount = 6;
                }
            } else if (throughputCapacity === 512 || throughputCapacity === 1024) {
                // Added this check for PGSQL HA
                if (wizardType === WIZARD_TYPE.PGSQL && deploymentMode?.label === GENERAL.FAILOVER_CLUSTER) {
                    svmCheck = svmCount < 13;
                    expectedSvmCount = 13;
                } else {
                    svmCheck = svmCount < 14;
                    expectedSvmCount = 14;
                }
            } else if (throughputCapacity === 2048 || throughputCapacity === 4096) {
                // Added this check for PGSQL HA
                if (wizardType === WIZARD_TYPE.PGSQL && deploymentMode?.label === GENERAL.FAILOVER_CLUSTER) {
                    svmCheck = svmCount < 23;
                    expectedSvmCount = 23;
                } else {
                    svmCheck = svmCount < 24;
                    expectedSvmCount = 24;
                }
            } else {
                svmCheck = true;
            }
            if (!svmCheck) {
                return `${GENERAL.FSXN_SVM_ERROR[0]} ${expectedSvmCount} ${GENERAL.FSXN_SVM_ERROR[1]} ${expectedSvmCount} ${GENERAL.FSXN_SVM_ERROR[2]}  ${throughputCapacity} ${GENERAL.FSXN_SVM_ERROR[3]} `;
            }

            if (!node1SubnetsList.includes(primarySubnet)) {
                return GENERAL.FSXN_PRIMARY_SUBNET_ERROR;
            }
            if (
                deploymentMode?.label === GENERAL.FAILOVER_CLUSTER &&
                fsxType &&
                (fsxType === FSX_DEPLOYMENT_MODE.MULTI_AZ_1 || fsxType === FSX_DEPLOYMENT_MODE.MULTI_AZ_2)
            ) {
                if (
                    fsxSubnets.every((val: string) => node1SubnetsList.includes(val) || node2SubnetsList.includes(val))
                ) {
                    return '';
                }
                return GENERAL.FSXN_SECONDARY_SUBNET_ERROR;
            }
            if (
                deploymentMode?.label === GENERAL.SINGLE_INSTANCE &&
                fsxType &&
                (fsxType === FSX_DEPLOYMENT_MODE.SINGLE_AZ_1 ||
                    fsxType === FSX_DEPLOYMENT_MODE.MULTI_AZ_1 ||
                    fsxType === FSX_DEPLOYMENT_MODE.SINGLE_AZ_2 ||
                    fsxType === FSX_DEPLOYMENT_MODE.MULTI_AZ_2)
            ) {
                if (fsxSubnets.some((val: string) => node1SubnetsList.includes(val))) {
                    return '';
                }
                return GENERAL.FSXN_PRIMARY_SUBNET_ERROR;
            }
            return GENERAL.FSXN_DEPLOYMENT_MODE_ERROR;
        }
        return GENERAL.FSXN_NOT_AVAILABLE;
    };

    // Function to generate the options for Select Field
    const generateExistingFsx = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        fsxnData?.filesystems?.map((val, idx: number) => {
            const value = (val?.name ? `${val.name} | ` : '') + val?.fileSystemId;
            const data = {
                fileSystemId: val?.fileSystemId,
                fileSystemName: val?.name,
                securityGroups: val?.securityGroups,
                throughput: val?.ontapConfiguration?.throughputCapacity,
                iops: val?.ontapConfiguration?.diskIopsConfiguration?.iops,
                preferredSubnetId: val?.ontapConfiguration?.preferredSubnetId,
                kmsKeyId: val?.kmsKeyId,
                deploymentType: val?.ontapConfiguration?.deploymentType
            };
            const disabledMsg = fsxCheck(val?.fileSystemId);
            const option = generateOptionType(value, value, '', disabledMsg !== '', disabledMsg, data);
            options.push(option);
        });
        return sortListOfDict(options, 'isDisabled');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fsxnData, selectedZone1, selectedZone2, deploymentMode]);

    useEffect(() => {
        if (!isLoadConfig && !movingFromChatbot) {
            const firstVal = generateExistingFsx[0];
            firstRowSelection(firstVal);
            dispatch(setFsxNExistingUserName(FSXADMIN));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [generateExistingFsx]);

    const firstRowSelection = (row: any) => {
        if (!row?.isDisabled) {
            dispatch(setExistingFsxnName(row));
        } else {
            dispatch(setExistingFsxnName(null));
        }
    };

    // FSX Name check to highlight the field
    useEffect(() => {
        if (!isFsxNotFilled && isCreateHit) {
            setTimeout(() => {
                // @ts-ignore
                fsxNameRef?.current?.focus();
            }, 10);
        }
    }, [isFsxNotFilled, isCreateHit]);

    // Set the Header text here
    const setHeader = () => {
        if (!credentialData || (credentialData && !credentialData.length)) {
            return (
                <DsTypography variant="Regular_14" className={CommonStyles['text-disabled']}>
                    {GENERAL.SELECT_ANY_ACCOUNT}
                </DsTypography>
            );
        }
        if (!selectedVPCData) {
            return <ActionRequired disabled />;
        }
        if (
            (deploymentMode?.label === GENERAL.FAILOVER_CLUSTER && (!selectedZone1 || !selectedZone2)) ||
            (deploymentMode?.label === GENERAL.SINGLE_INSTANCE && !selectedZone1)
        ) {
            return (
                <DsTypography variant="Regular_14" className={CommonStyles['text-disabled']}>
                    {GENERAL.SELECT_AZ}
                </DsTypography>
            );
        }

        if (isGovAccount) {
            if (isFsxnNew(selectedFsxnType)) {
                if (!fsxSsmParameterArn) {
                    return <ActionRequired error={!isFsxNotFilled} />;
                }
                if (!isValidSsmArn(fsxSsmParameterArn)) {
                    return <AccordionError />;
                }
                return <DsTypography variant="Regular_14">{GENERAL.CREATE_NEW_FSXN_SYSTEM}</DsTypography>;
            }
            if (!selectedExistingFsxnName?.label || !fsxSsmParameterArn) {
                return <ActionRequired />;
            }
            if (!isValidSsmArn(fsxSsmParameterArn)) {
                return <AccordionError />;
            }
            return <DsTypography variant="Regular_14">{selectedExistingFsxnName.label}</DsTypography>;
        }

        // Checking for the create new option
        if (isFsxnNew(selectedFsxnType)) {
            if (!selectedFsxnNewUserName || !selectedFsxnPassword) {
                return <ActionRequired error={!isFsxNotFilled} />;
            }
            if (fsxPassVal(password)) {
                return <AccordionError />;
            }
            return <DsTypography variant="Regular_14">{GENERAL.CREATE_NEW_FSXN_SYSTEM}</DsTypography>;
        }
        // Checking for the existing option
        if (!selectedExistingFsxnName?.label || !selectedFsxnExistingUserName || !selectedFsxnPassword) {
            return <ActionRequired />;
        }
        if (fsxPassVal(password)) {
            return <AccordionError />;
        }
        return <DsTypography variant="Regular_14">{selectedExistingFsxnName.label}</DsTypography>;
    };

    const disableCheck = (() => {
        if (deploymentMode?.label === GENERAL.FAILOVER_CLUSTER) {
            return (
                !credentialData ||
                (credentialData && !credentialData.length) ||
                !selectedVPCData ||
                !selectedZone1 ||
                !selectedZone2
            );
        }
        return !credentialData || (credentialData && !credentialData.length) || !selectedVPCData || !selectedZone1;
    })();

    return (
        <div className={styles.fsx}>
            <AccordionCard
                isLoading={fsxnLoading}
                isDisabled={disableCheck}
                isExpandDisabled={disableCheck}
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="15"
                title={<div className={CommonStyles.title}>{GENERAL.FSXN_SYSTEM}</div>}
            >
                <AccordionCardContent>
                    <DsTypography>
                        <div className={styles.handleRadio}>
                            <RadioButton
                                isChecked={isFsxnNew(selectedFsxnType)}
                                onChange={() => {
                                    dispatch(setFsxNType(FORM_OPTIONS.FSXN_NEW));
                                    dispatch(setIsWizardTouched(true));
                                }}
                                children={GENERAL.CREATE_NEW_FSXN}
                                className=""
                            />
                            <RadioButton
                                isChecked={isFsxnExisting(selectedFsxnType)}
                                onChange={() => {
                                    dispatch(setFsxNType(FORM_OPTIONS.FSXN_EXISTING));
                                    dispatch(setIsWizardTouched(true));
                                }}
                                children={GENERAL.SELECT_EXISTING_FSX}
                                className=""
                            />
                        </div>
                        {isFsxnExisting(selectedFsxnType) && (
                            <div className={styles.firstContainer}>
                                <SelectField
                                    label={GENERAL.FSXN_NAME}
                                    isClearable={false}
                                    defaultValue={
                                        selectedExistingFsxnName
                                            ? [selectedExistingFsxnName]
                                            : [firstRowSelection(generateExistingFsx[0])]
                                    }
                                    onChange={(selectedOptions: any): void => {
                                        dispatch(setExistingFsxnName(selectedOptions));
                                        dispatch(setIsWizardTouched(true));
                                    }}
                                    isSearchable={generateExistingFsx.length > 5}
                                    options={generateExistingFsx}
                                    className={styles.textField}
                                />
                            </div>
                        )}

                        <div
                            className={
                                isFsxnExisting(selectedFsxnType)
                                    ? `${styles.secondContainer}`
                                    : `${styles.createNewContainer}`
                            }
                        >
                            {isGovAccount ? (
                                <TextField
                                    label={t('databases.register-flow.ssm-parameter-arn-label')}
                                    placeholder={t('databases.register-flow.ssm-parameter-arn-placeholder')}
                                    error={
                                        !isFsxNotFilled && !fsxSsmParameterArn
                                            ? GENERAL.ACTION_REQUIRED
                                            : fsxSsmParameterArn && !isValidSsmArn(fsxSsmParameterArn)
                                            ? t('databases.register-flow.ssm-parameter-arn-invalid')
                                            : ''
                                    }
                                    // @ts-ignore
                                    isErrorPrefixHidden
                                    customErrorWarningIcon={
                                        <WarningIcon
                                            style={{
                                                width: '16px',
                                                height: '16px',
                                                // @ts-ignore
                                                '--icon-primary-color': 'var(--error)'
                                            }}
                                        />
                                    }
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        dispatch(setFsxNSsmArn(e.target.value));
                                        dispatch(setIsWizardTouched(true));
                                    }}
                                    value={fsxSsmParameterArn}
                                    className={styles.textField}
                                />
                            ) : (
                                <>
                                    <TextField
                                        label={GENERAL.USER_NAME}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            dispatch(setFsxNExistingUserName(e.target.value));
                                            dispatch(setIsWizardTouched(true));
                                        }}
                                        value={
                                            isFsxnExisting(selectedFsxnType) && selectedFsxnExistingUserName
                                                ? selectedFsxnExistingUserName
                                                : FSXADMIN
                                        }
                                        className={styles.textField}
                                        isDisabled={isFsxnNew(selectedFsxnType)}
                                    />
                                    <PasswordField
                                        label={GENERAL.FSX_PASSWORD}
                                        info={
                                            <DsTypography variant="Regular_13" className={styles.infoMsg}>
                                                <div className={styles.bulletContainer}>
                                                    <Bullet />
                                                    <DsTypography variant="Regular_13">
                                                        {GENERAL.PASSWORD_FSX_1}
                                                    </DsTypography>
                                                </div>
                                                <div className={styles.bulletContainer}>
                                                    <Bullet />
                                                    <DsTypography variant="Regular_13">
                                                        {GENERAL.PASSWORD_FSX_2}
                                                    </DsTypography>
                                                </div>
                                                <div className={styles.bulletContainer}>
                                                    <Bullet />
                                                    <DsTypography variant="Regular_13">
                                                        {GENERAL.PASSWORD_FSX_3}
                                                    </DsTypography>
                                                </div>
                                                <div className={styles.bulletContainer}>
                                                    <Bullet />
                                                    <DsTypography variant="Regular_13">
                                                        {GENERAL.PASSWORD_FSX_4}
                                                    </DsTypography>
                                                </div>
                                            </DsTypography>
                                        }
                                        error={
                                            !isFsxNotFilled && !selectedFsxnPassword
                                                ? GENERAL.ACTION_REQUIRED
                                                : fsxPassVal(password)
                                        }
                                        isErrorPrefixHidden
                                        customErrorWarningIcon={
                                            <WarningIcon
                                                style={{
                                                    width: '16px',
                                                    height: '16px',
                                                    // @ts-ignore
                                                    '--icon-primary-color': 'var(--error)'
                                                }}
                                            />
                                        }
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            setPassword(e.target.value);
                                            dispatch(setFsxNPassword(e.target.value));
                                            dispatch(setIsWizardTouched(true));
                                        }}
                                        value={selectedFsxnPassword}
                                        className={styles.textFieldPassword}
                                    />
                                </>
                            )}
                        </div>

                        <DsTypography variant="Regular_14" className={styles.bottomText}>
                            <span style={{ fontWeight: '590' }}>{GENERAL.NOTICE}</span>&nbsp;
                            {GENERAL.NOTICE_FSX_TEXT}
                        </DsTypography>
                    </DsTypography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default FSxNSystem;
