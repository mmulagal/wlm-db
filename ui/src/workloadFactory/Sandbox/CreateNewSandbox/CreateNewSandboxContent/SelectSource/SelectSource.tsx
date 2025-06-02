import { useEffect, useMemo } from 'react';

import {
    AccordionCard,
    AccordionCardContent,
    DsTypography,
    SelectField,
    useAccordionContext
} from '@netapp/design-system';
import { optionType } from '@netapp/design-system/dist/components/Select';
import styles from './SelectSource.module.scss';
import CommonStyles from '../../../../../utils/CommonStyles.module.scss';
import { generateOptionType, isSmbProtocol } from '../../../../../utils/utilityFunctions';
import useResize from '../../../../../common/hooks/useResize';
import { useAppSelector } from '../../../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import {
    setCreateSandboxPressed,
    setDbMountPointsState,
    setSourceDatabase,
    setSourceDbHost,
    setSourceDbInstance
} from '../../../../../store/workloadFactory/createSandboxSlice';
import { GENERAL } from '../../../../../utils/appConstants';
import { MSSQL_DATABASE_TYPES, STATUS_CONST } from '../../../../../utils/consts';

const SelectSource = () => {
    const windowSize = useResize();
    const accordionContext = useAccordionContext()?.setOpenChildren!;
    const {
        isSourceSelected,
        isTargetSelected,
        isMountPathAdded,
        isCreateSandboxPressed,
        showError,
        getDatabaseHosts,
        getDatabaseList,
        aggregatedDbHostList
    } = useAppSelector(state => state.createSandbox);
    const { selectedCs } = useAppSelector(state => state.createSandbox);
    const { source } = useAppSelector(state => state.createSandbox);
    const { isDemoMode } = useAppSelector(state => state?.auth);
    const { selectedDatabaseHost, selectedDatabaseInstance, selectedDatabase } = source;
    const { databaseListData, databaseListLoading } = getDatabaseList;
    const { databaseHostsLoading } = getDatabaseHosts;
    const dispatch = useDispatch();

    useEffect(() => {
        // by default Select source accordion will be opened
        accordionContext({
            1: true
        });
    }, []);

    useEffect(() => {
        if (isCreateSandboxPressed && (!isSourceSelected || !isTargetSelected || isMountPathAdded)) {
            accordionContext({
                1: !isSourceSelected ? true : false,
                2: !isTargetSelected ? true : false,
                3: !isMountPathAdded ? true : false
            });
            dispatch(setCreateSandboxPressed(false));
        }
    }, [accordionContext, isCreateSandboxPressed, isSourceSelected, isTargetSelected, isMountPathAdded]);

    //Function to generate the options for Select Field
    const generateHostName = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        let selected_item = null;
        aggregatedDbHostList?.map((obj: any, idx: number) => {
            const isHostUp = obj?.databaseHostStatus?.toLowerCase() === STATUS_CONST.ONLINE.toLowerCase();
            if (isHostUp) {
                const protocolDisable = isSmbProtocol(obj?.storage?.fsxn?.protocol);
                const option = generateOptionType(
                    obj?.id,
                    obj?.name,
                    '',
                    !isDemoMode && protocolDisable,
                    protocolDisable ? GENERAL?.SANDBOX_SMB_PROTOCOL_NOT_SUPPORTED : '',
                    obj
                );
                if (selectedCs?.selectedDatabaseHost === obj?.name) {
                    selected_item = option;
                } else {
                    options.push(option);
                }
            }
        });

        if (selected_item) {
            options.unshift(selected_item);
        }

        return options;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [aggregatedDbHostList]);

    const generateSourceInstance = useMemo<optionType[]>((): optionType[] => {
        let instanceList = [];
        let selected_item = null;
        const selectedHostData: any = aggregatedDbHostList.find(
            (hostItem: any) => hostItem?.id === selectedDatabaseHost?.value
        );
        instanceList = selectedHostData?.databaseInstancesSummary
            ? selectedHostData.databaseInstancesSummary.map((instanceItem: any) => {
                  return {
                      value: instanceItem?.databaseInstanceId,
                      label: instanceItem?.databaseInstanceName,
                      status: instanceItem?.status,
                      fileSystemId: instanceItem?.databaseInstanceTopology?.fileSystemId
                  };
              })
            : [];
        const options: optionType[] = [];
        instanceList?.map((obj: any, idx: number) => {
            const option = generateOptionType(obj?.value, obj?.label, '', false, '', obj);
            if (obj?.status?.toLowerCase() === STATUS_CONST.UP.toLowerCase()) {
                if (selectedCs?.selectedDatabaseInstance?.toLowerCase() === obj?.label?.toLowerCase()) {
                    selected_item = option;
                } else {
                    options.push(option);
                }
            }
        });
        if (selected_item) {
            options.unshift(selected_item);
        }
        return options;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDatabaseHost]);

    const generateSourceDatabase = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        let selected_item = null;
        databaseListData?.map((obj, idx: number) => {
            if (obj.type !== MSSQL_DATABASE_TYPES.SYSTEM && obj?.status === 'ONLINE') {
                const option = generateOptionType(obj?.id, obj?.name, '', false, '');
                if (selectedCs?.selectedDatabase === obj?.name) {
                    selected_item = option;
                } else {
                    options.push(option);
                }
            }
        });
        if (selected_item) {
            options.unshift(selected_item);
        }
        return options;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [databaseListData]);

    useEffect(() => {
        if (generateHostName?.length) {
            dispatch(setSourceDbHost(generateHostName.find(item => !item?.isDisabled)));
        }
    }, [generateHostName]);

    useEffect(() => {
        if (generateSourceDatabase?.length) {
            dispatch(setSourceDatabase(generateSourceDatabase[0]));
        }
    }, [generateSourceDatabase]);

    useEffect(() => {
        if (generateSourceInstance?.length) {
            dispatch(setSourceDbInstance(generateSourceInstance[0]));
        }
    }, [generateSourceInstance]);

    const setHeader = () => {
        return (
            <DsTypography
                variant="Regular_14"
                title={`${selectedDatabaseHost ? selectedDatabaseHost.label : ''}, ${
                    selectedDatabaseInstance ? selectedDatabaseInstance.label : ''
                }, ${selectedDatabase ? selectedDatabase.label : ''}`}
                className={CommonStyles.setHeaderStyleSandbox}
            >
                <span>
                    {GENERAL.SOURCE_HOST}: {selectedDatabaseHost ? selectedDatabaseHost.label : 'NA'}
                </span>
                <span className={CommonStyles.separatorSandbox} />
                <span>
                    {GENERAL.SOURCE_DATABASE}: {selectedDatabase ? selectedDatabase.label : 'NA'}
                </span>
            </DsTypography>
        );
    };
    return (
        <div className={styles.selectSource}>
            <AccordionCard
                ValueContent={() => (
                    <div className={`${CommonStyles['heading-content']} ${styles.headerSetter}`}>{setHeader()}</div>
                )}
                id="1"
                title={<div className={CommonStyles.title}>{GENERAL.DATABASE_SOURCE}</div>}
            >
                <AccordionCardContent>
                    <DsTypography>
                        <>
                            <div className={windowSize.width > 1500 ? styles.firstRow : styles.firstRowSmallScreen}>
                                <SelectField
                                    label={GENERAL.SOURCE_HOST}
                                    isClearable={false}
                                    onChange={(selectedOptions: any): void => {
                                        dispatch(setSourceDbHost(selectedOptions));
                                        dispatch(setSourceDbInstance(null));
                                        dispatch(setSourceDatabase(null));
                                        dispatch(
                                            setDbMountPointsState({
                                                dbMountPointsData: null,
                                                dbMountPointsLoading: true
                                            })
                                        );
                                    }}
                                    value={selectedDatabaseHost}
                                    isSearchable={true}
                                    options={generateHostName}
                                    className={styles.selectField}
                                    isLoading={databaseHostsLoading}
                                    error={showError && !selectedDatabaseHost ? GENERAL.ACTION_REQUIRED : ''}
                                />

                                <SelectField
                                    label={GENERAL.SOURCE_INSTANCE}
                                    isClearable={false}
                                    value={selectedDatabaseInstance}
                                    onChange={(selectedOptions: any): void => {
                                        dispatch(setSourceDbInstance(selectedOptions));
                                        dispatch(setSourceDatabase(null));
                                        dispatch(
                                            setDbMountPointsState({
                                                dbMountPointsData: null,
                                                dbMountPointsLoading: true
                                            })
                                        );
                                    }}
                                    isLoading={databaseHostsLoading}
                                    isSearchable={true}
                                    options={generateSourceInstance}
                                    className={styles.selectField}
                                />

                                {windowSize.width <= 1500 && (
                                    <SelectField
                                        label={GENERAL.SOURCE_DATABASE}
                                        isClearable={false}
                                        defaultValue={selectedDatabase ? selectedDatabase : [generateSourceDatabase[0]]}
                                        onChange={(selectedOptions: any): void => {
                                            dispatch(setSourceDatabase(selectedOptions));
                                            dispatch(
                                                setDbMountPointsState({
                                                    dbMountPointsData: null,
                                                    dbMountPointsLoading: true
                                                })
                                            );
                                        }}
                                        value={selectedDatabase}
                                        isSearchable={true}
                                        options={generateSourceDatabase}
                                        className={styles.selectField}
                                        isLoading={databaseListLoading}
                                        error={showError && !selectedDatabase ? GENERAL.ACTION_REQUIRED : ''}
                                    />
                                )}
                            </div>

                            {windowSize.width > 1500 && (
                                <div className={styles.secondRow}>
                                    <SelectField
                                        label={GENERAL.SOURCE_DATABASE}
                                        isClearable={false}
                                        defaultValue={selectedDatabase ? selectedDatabase : [generateSourceDatabase[0]]}
                                        onChange={(selectedOptions: any): void => {
                                            dispatch(setSourceDatabase(selectedOptions));
                                            dispatch(
                                                setDbMountPointsState({
                                                    dbMountPointsData: null,
                                                    dbMountPointsLoading: true
                                                })
                                            );
                                        }}
                                        value={selectedDatabase}
                                        isSearchable={true}
                                        options={generateSourceDatabase}
                                        className={styles.selectField}
                                        isLoading={databaseListLoading}
                                        error={showError && !selectedDatabase ? GENERAL.ACTION_REQUIRED : ''}
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

export default SelectSource;
