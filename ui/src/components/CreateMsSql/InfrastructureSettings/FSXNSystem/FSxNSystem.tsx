import { useState, useMemo, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import {
    AccordionCard,
    AccordionCardContent,
    PasswordField,
    RadioButton,
    TextField,
    Typography
} from '@netapp/design-system';
import ActionRequired from '../../../../common/ActionRequired/ActionRequired';
import { GENERAL } from '../../../../utils/appConstants';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import { fsxPassVal, generateOptionType, sortListOfDict } from '../../../../utils/utilityFunctions';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';
import { ReactComponent as WarningIcon } from '@netapp/icons/ic_notice_triangle.svg';
import { useAppSelector } from '../../../../store/storeHooks';
import {
    setExistingFsxnName,
    setFsxNPassword,
    setFsxNType,
    setFsxNExistingUserName
} from '../../../../store/mssql/mssqlFormSlice';
import { FSXADMIN, FSX_DEPLOYMENT_MODE } from '../../../../utils/consts';
import AccordionError from '../../../../common/AccordionError/AccordionError';

import styles from './FSxNSystem.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { setIsWizardTouched } from '../../../../store/chatbot/chatbotSlice';

const FSxNSystem = () => {
    const dispatch = useDispatch();

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
        let selectedFsx = fsxnData?.filesystems?.filter((perRow: any) => perRow?.fileSystemId === fsxId);
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
                svmCheck = svmCount < 6 ? true : false;
                expectedSvmCount = 6;
            } else if (throughputCapacity === 512 || throughputCapacity === 1024) {
                svmCheck = svmCount < 14 ? true : false;
                expectedSvmCount = 14;
            } else if (throughputCapacity === 2048 || throughputCapacity === 4096) {
                svmCheck = svmCount < 24 ? true : false;
                expectedSvmCount = 24;
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
                fsxType === FSX_DEPLOYMENT_MODE.MULTI_AZ_1
            ) {
                if (
                    fsxSubnets.every((val: string) => node1SubnetsList.includes(val) || node2SubnetsList.includes(val))
                ) {
                    return '';
                } else {
                    return GENERAL.FSXN_SECONDARY_SUBNET_ERROR;
                }
            } else if (deploymentMode?.label === GENERAL.SINGLE_INSTANCE) {
                if (fsxSubnets.some((val: string) => node1SubnetsList.includes(val))) {
                    return '';
                } else {
                    return GENERAL.FSXN_PRIMARY_SUBNET_ERROR;
                }
            } else {
                return GENERAL.FSXN_DEPLOYMENT_MODE_ERROR;
            }
        } else {
            return GENERAL.FSXN_NOT_AVAILABLE;
        }
    };

    //Function to generate the options for Select Field
    const generateExistingFsx = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        fsxnData?.filesystems?.map((val, idx: number) => {
            const value = (val?.name ? val.name + ' | ' : '') + val?.fileSystemId;
            const data = {
                fileSystemId: val?.fileSystemId,
                fileSystemName: val?.name,
                securityGroups: val?.securityGroups,
                throughput: val?.ontapConfiguration?.throughputCapacity,
                iops: val?.ontapConfiguration?.diskIopsConfiguration?.iops,
                preferredSubnetId: val?.ontapConfiguration?.preferredSubnetId,
                kmsKeyId: val?.kmsKeyId
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

    //FSX Name check to highlight the field
    useEffect(() => {
        if (!isFsxNotFilled && isCreateHit) {
            setTimeout(() => {
                //@ts-ignore
                fsxNameRef?.current?.focus();
            }, 10);
        }
    }, [isFsxNotFilled, isCreateHit]);

    //Set the Header text here
    const setHeader = () => {
        if (!credentialData || (credentialData && !credentialData.length)) {
            return (
                <Typography variant="Regular_14" className={CommonStyles['text-disabled']}>
                    {GENERAL.SELECT_ANY_ACCOUNT}
                </Typography>
            );
        } else if (!selectedVPCData) {
            return <ActionRequired disabled />;
        } else if (
            (deploymentMode?.label === GENERAL.FAILOVER_CLUSTER && (!selectedZone1 || !selectedZone2)) ||
            (deploymentMode?.label === GENERAL.SINGLE_INSTANCE && !selectedZone1)
        ) {
            return (
                <Typography variant="Regular_14" className={CommonStyles['text-disabled']}>
                    {GENERAL.SELECT_AZ}
                </Typography>
            );
        }

        //Checking for the create new option
        if (selectedFsxnType === GENERAL.CREATE_NEW_FSXN) {
            if (!selectedFsxnNewUserName || !selectedFsxnPassword) {
                return <ActionRequired error={!isFsxNotFilled ? true : false} />;
            } else if (fsxPassVal(password)) {
                return <AccordionError />;
            } else {
                return <Typography variant="Regular_14">{GENERAL.CREATE_NEW_FSXN_SYSTEM}</Typography>;
            }
        } else {
            //Checking for the existing option
            if (!selectedExistingFsxnName?.label || !selectedFsxnExistingUserName || !selectedFsxnPassword) {
                return <ActionRequired />;
            } else if (fsxPassVal(password)) {
                return <AccordionError />;
            } else {
                return <Typography variant="Regular_14">{selectedExistingFsxnName.label}</Typography>;
            }
        }
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
        } else {
            return !credentialData || (credentialData && !credentialData.length) || !selectedVPCData || !selectedZone1;
        }
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
                    <Typography>
                        <div className={styles.handleRadio}>
                            <RadioButton
                                isChecked={selectedFsxnType === GENERAL.CREATE_NEW_FSXN}
                                onChange={() => {
                                    dispatch(setFsxNType(GENERAL.CREATE_NEW_FSXN));
                                    dispatch(setIsWizardTouched(true));
                                }}
                                children={GENERAL.CREATE_NEW_FSXN}
                                className=""
                            />
                            <RadioButton
                                isChecked={selectedFsxnType === GENERAL.SELECT_EXISTING_FSX}
                                onChange={() => {
                                    dispatch(setFsxNType(GENERAL.SELECT_EXISTING_FSX));
                                    dispatch(setIsWizardTouched(true));
                                }}
                                children={GENERAL.SELECT_EXISTING_FSX}
                                className=""
                            />
                        </div>
                        {selectedFsxnType === GENERAL.SELECT_EXISTING_FSX && (
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
                                selectedFsxnType === GENERAL.SELECT_EXISTING_FSX
                                    ? `${styles.secondContainer}`
                                    : `${styles.createNewContainer}`
                            }
                        >
                            <TextField
                                label={GENERAL.USER_NAME}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    dispatch(setFsxNExistingUserName(e.target.value));
                                    dispatch(setIsWizardTouched(true));
                                }}
                                value={
                                    selectedFsxnType === GENERAL.SELECT_EXISTING_FSX && selectedFsxnExistingUserName
                                        ? selectedFsxnExistingUserName
                                        : FSXADMIN
                                }
                                className={styles.textField}
                                isDisabled={selectedFsxnType === GENERAL.CREATE_NEW_FSXN}
                            />
                            <PasswordField
                                label={GENERAL.FSX_PASSWORD}
                                info={
                                    <Typography variant="Regular_13" className={styles.infoMsg}>
                                        <div className={styles.bulletContainer}>
                                            <Bullet />
                                            <Typography variant="Regular_13">{GENERAL.PASSWORD_FSX_1}</Typography>
                                        </div>
                                        <div className={styles.bulletContainer}>
                                            <Bullet />
                                            <Typography variant="Regular_13">{GENERAL.PASSWORD_FSX_2}</Typography>
                                        </div>
                                        <div className={styles.bulletContainer}>
                                            <Bullet />
                                            <Typography variant="Regular_13">{GENERAL.PASSWORD_FSX_3}</Typography>
                                        </div>
                                    </Typography>
                                }
                                error={
                                    !isFsxNotFilled && !selectedFsxnPassword
                                        ? GENERAL.ACTION_REQUIRED
                                        : // eslint-disable-next-line react-hooks/rules-of-hooks
                                          '' || fsxPassVal(password)
                                }
                                isErrorPrefixHidden
                                customErrorWarningIcon={
                                    <WarningIcon
                                        style={{
                                            width: '16px',
                                            height: '16px',
                                            //@ts-ignore
                                            '--icon-primary-color': 'var(--error'
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
                        </div>

                        <Typography variant="Regular_14" className={styles.bottomText}>
                            <span style={{ fontWeight: '590' }}>{GENERAL.NOTICE}</span>&nbsp;
                            {GENERAL.NOTICE_FSX_TEXT}
                        </Typography>
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default FSxNSystem;
