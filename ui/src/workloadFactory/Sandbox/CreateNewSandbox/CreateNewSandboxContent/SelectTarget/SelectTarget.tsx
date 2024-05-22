import { useEffect, useMemo } from 'react';
import { optionType } from '@netapp/design-system/dist/components/Select';
import { AccordionCard, AccordionCardContent, DsTypography, TextField, SelectField } from '@netapp/design-system';
import { ReactComponent as InfoIcon } from '@netapp/icons/ic_info.svg';
import { generateOptionType } from '../../../../../utils/utilityFunctions';
import useResize from '../../../../../common/hooks/useResize';
import { useAppSelector } from '../../../../../store/storeHooks';
import styles from './SelectTarget.module.scss';
import CommonStyles from '../../../../../utils/CommonStyles.module.scss';
import { useDispatch } from 'react-redux';
import {
    setTargetDbHost,
    setTargetDbInstance,
    setTargetDatabase
} from '../../../../../store/workloadFactory/createSandboxSlice';
import { GENERAL } from '../../../../../utils/appConstants';
import ActionRequired from '../../../../../common/ActionRequired/ActionRequired';
import { STATUS_CONST } from '../../../../../utils/consts';
import { ReactComponent as Bullet } from '../../../../../assets/ic_bullet.svg';
import { useDelayedError } from '../../../../../common/hooks/useDelayedError';
import { isValidDatabaseName } from '../../../../CreateNewDB/CreateNewDBFooter/createUserDBPayload';

const SelectTarget = () => {
    const windowSize = useResize();
    const dispatch = useDispatch();

    const { target, source, aggregatedDbHostList, showError } = useAppSelector(state => state.createSandbox);
    const { isDemoMode } = useAppSelector(state => state.auth);
    const { selectedDatabaseHost, selectedDatabase, selectedDatabaseInstance } = target;
    const { selectedDatabaseHost: selectedSourceDbHost } = source;

    //Function to generate the options for Select Field
    const generateTargetName = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        const filteredHosts = selectedSourceDbHost
            ? aggregatedDbHostList.filter(
                  item =>
                      item?.topology?.fileSystemId &&
                      item?.topology?.fileSystemId === selectedSourceDbHost?.data?.topology?.fileSystemId &&
                      item?.topology?.vpcId &&
                      item?.topology?.vpcId === selectedSourceDbHost?.data?.topology?.vpcId &&
                      item?.status === STATUS_CONST.UP
              )
            : [];
        filteredHosts?.map((obj, idx: number) => {
            const option = generateOptionType(obj?.id, obj?.name, '', false, '', obj);
            options.push(option);
        });

        return options;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [aggregatedDbHostList, selectedSourceDbHost]);

    const generateTargetInstance = useMemo<optionType[]>((): optionType[] => {
        const hostName = [{ label: 'MSSQLSERVER', value: 'MSSQLSERVER' }];
        const options: optionType[] = [];
        hostName?.map((obj, idx: number) => {
            const option = generateOptionType(obj?.value, obj?.label, '', false, '');
            options.push(option);
        });

        return options;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const isValidDBName = () => {
        if (isDemoMode) {
            return '';
        }
        if (showError && !selectedDatabase) {
            return GENERAL.ACTION_REQUIRED;
        }
        return isValidDatabaseName(selectedDatabase) ? '' : GENERAL.DB_NAME_ERROR_CHECK;
    };

    useEffect(() => {
        if (generateTargetName?.length) {
            dispatch(setTargetDbHost(generateTargetName[0]));
        }
    }, [generateTargetName]);

    useEffect(() => {
        if (generateTargetInstance?.length) {
            dispatch(setTargetDbInstance(generateTargetInstance[0]));
        }
    }, [generateTargetInstance]);

    const setHeader = () => {
        if (!selectedDatabase) {
            return (
                <div className={styles.actionRequired}>
                    <ActionRequired />
                </div>
            );
        } else {
            return (
                <DsTypography
                    variant="Regular_14"
                    title={`${selectedDatabaseHost ? selectedDatabaseHost.label : ''}, ${
                        selectedDatabaseInstance ? selectedDatabaseInstance.label : ''
                    }, ${selectedDatabase ? selectedDatabase : ''}`}
                    className={CommonStyles.setHeaderStyleSandbox}
                >
                    <span>
                        {GENERAL.TARGET_HOST}: {selectedDatabaseHost ? selectedDatabaseHost.label : 'NA'}
                    </span>
                    <span className={CommonStyles.separatorSandbox} />
                    <span>
                        {GENERAL.TARGET_DATABASES}: {selectedDatabase ? selectedDatabase : 'NA'}
                    </span>
                </DsTypography>
            );
        }
    };
    return (
        <div className={styles.selectTarget}>
            <AccordionCard
                ValueContent={() => (
                    <div className={`${CommonStyles['heading-content']} ${styles.headerSetter}`}>{setHeader()}</div>
                )}
                id="2"
                title={<div className={CommonStyles.title}>{GENERAL.Database_TARGET}</div>}
            >
                <AccordionCardContent>
                    <DsTypography>
                        <>
                            <div className={styles.noticeText}>
                                <InfoIcon />
                                <DsTypography variant="Regular_14">{GENERAL.TARGET_DATABASE_NOTICE}</DsTypography>
                            </div>
                            <div className={windowSize.width > 1500 ? styles.firstRow : styles.firstRowSmallScreen}>
                                <SelectField
                                    label={GENERAL.TARGET_HOST}
                                    isClearable={false}
                                    defaultValue={selectedDatabaseHost ? selectedDatabaseHost : generateTargetName[0]}
                                    onChange={(selectedOptions: any): void => {
                                        dispatch(setTargetDbHost(selectedOptions));
                                    }}
                                    value={selectedDatabaseHost}
                                    isSearchable={true}
                                    options={generateTargetName}
                                    className={styles.selectField}
                                    error={showError && !selectedDatabaseHost ? GENERAL.ACTION_REQUIRED : ''}
                                />

                                <SelectField
                                    label={GENERAL.TARGET_INSTANCE}
                                    isClearable={false}
                                    defaultValue={
                                        selectedDatabaseInstance
                                            ? selectedDatabaseInstance
                                            : [generateTargetInstance[0]]
                                    }
                                    onChange={(selectedOptions: any): void => {
                                        dispatch(setTargetDbInstance(selectedOptions));
                                    }}
                                    isSearchable={true}
                                    options={generateTargetInstance}
                                    className={styles.selectField}
                                    isDisabled={true}
                                />

                                {windowSize.width <= 1500 && (
                                    <TextField
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            dispatch(setTargetDatabase(e.target.value));
                                        }}
                                        label={GENERAL.TARGET_DATABASES}
                                        value={selectedDatabase}
                                        className={styles.keyField}
                                        error={isValidDBName()}
                                        info={
                                            <div className={styles.dbNameTooltip}>
                                                <div className={styles.listItem}>
                                                    <Bullet />
                                                    <DsTypography variant="Regular_13" className={styles.textWidth}>
                                                        {GENERAL.CREATE_DB_NAME_TOOLTIP[0]}
                                                    </DsTypography>
                                                </div>
                                                <div className={styles.listItem}>
                                                    <Bullet />
                                                    <DsTypography variant="Regular_13" className={styles.textWidth}>
                                                        {GENERAL.CREATE_DB_NAME_TOOLTIP[1]}
                                                    </DsTypography>
                                                </div>
                                                <div className={styles.listItem}>
                                                    <Bullet />
                                                    <DsTypography variant="Regular_13" className={styles.textWidth}>
                                                        {GENERAL.CREATE_DB_NAME_TOOLTIP[2]}
                                                    </DsTypography>
                                                </div>
                                            </div>
                                        }
                                    />
                                )}
                            </div>

                            {windowSize.width > 1500 && (
                                <div className={styles.secondRow}>
                                    <TextField
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            dispatch(setTargetDatabase(e.target.value));
                                        }}
                                        label={GENERAL.TARGET_DATABASES}
                                        value={selectedDatabase}
                                        className={styles.keyField}
                                        error={isValidDBName()}
                                        info={
                                            <div className={styles.dbNameTooltip}>
                                                <div className={styles.listItem}>
                                                    <Bullet />
                                                    <DsTypography variant="Regular_13" className={styles.textWidth}>
                                                        {GENERAL.CREATE_DB_NAME_TOOLTIP[0]}
                                                    </DsTypography>
                                                </div>
                                                <div className={styles.listItem}>
                                                    <Bullet />
                                                    <DsTypography variant="Regular_13" className={styles.textWidth}>
                                                        {GENERAL.CREATE_DB_NAME_TOOLTIP[1]}
                                                    </DsTypography>
                                                </div>
                                                <div className={styles.listItem}>
                                                    <Bullet />
                                                    <DsTypography variant="Regular_13" className={styles.textWidth}>
                                                        {GENERAL.CREATE_DB_NAME_TOOLTIP[2]}
                                                    </DsTypography>
                                                </div>
                                            </div>
                                        }
                                    />
                                </div>
                            )}
                        </>
                    </DsTypography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default SelectTarget;
