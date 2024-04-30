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
import { generateOptionType } from '../../../../../utils/utilityFunctions';
import useResize from '../../../../../common/hooks/useResize';
import { useAppSelector } from '../../../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import {
    setCreateSandboxPressed,
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
    const { source } = useAppSelector(state => state.createSandbox);
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
        aggregatedDbHostList?.map((obj, idx: number) => {
            if (obj.status === STATUS_CONST.UP) {
                const option = generateOptionType(obj?.id, obj?.name, '', false, '', obj);
                options.push(option);
            }
        });

        return options;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [aggregatedDbHostList]);

    const generateSourceInstance = useMemo<optionType[]>((): optionType[] => {
        const hostName = [{ label: 'MS SQL SERVER', value: 'MSSQLSERVER' }];
        const options: optionType[] = [];
        hostName?.map((obj, idx: number) => {
            const option = generateOptionType(obj?.value, obj?.label, '', false, '');
            options.push(option);
        });

        return options;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const generateSourceDatabase = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        databaseListData?.map((obj, idx: number) => {
            if (obj.type !== MSSQL_DATABASE_TYPES.SYSTEM) {
                const option = generateOptionType(obj?.id, obj?.name, '', false, '');
                options.push(option);
            }
        });

        return options;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [databaseListData]);

    useEffect(() => {
        if (
            source.selectedDatabaseHost === null &&
            source.selectedDatabaseInstance === null &&
            source.selectedDatabaseInstance === null &&
            generateSourceInstance &&
            generateSourceDatabase &&
            generateHostName
        ) {
            dispatch(setSourceDbHost(generateHostName[0]));
            dispatch(setSourceDbInstance(generateSourceInstance[0]));
            dispatch(setSourceDatabase(generateSourceDatabase[0]));
        }
    }, [generateSourceInstance, generateSourceDatabase, generateHostName]);

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
                    {GENERAL.SOURCE_INSTANCE}: {selectedDatabaseInstance ? selectedDatabaseInstance.label : 'NA'}
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
                                    }}
                                    isSearchable={true}
                                    options={generateHostName}
                                    className={styles.selectField}
                                    isLoading={databaseHostsLoading}
                                    error={showError && !selectedDatabaseHost ? GENERAL.ACTION_REQUIRED : ''}
                                />

                                <SelectField
                                    label={GENERAL.SOURCE_INSTANCE}
                                    isClearable={false}
                                    defaultValue={
                                        selectedDatabaseInstance
                                            ? selectedDatabaseInstance
                                            : [generateSourceInstance[0]]
                                    }
                                    onChange={(selectedOptions: any): void => {
                                        dispatch(setSourceDbInstance(selectedOptions));
                                    }}
                                    isSearchable={true}
                                    options={generateSourceInstance}
                                    className={styles.selectField}
                                    isDisabled={true}
                                />

                                {windowSize.width <= 1500 && (
                                    <SelectField
                                        label={GENERAL.SOURCE_DATABASE}
                                        isClearable={false}
                                        defaultValue={selectedDatabase ? selectedDatabase : [generateSourceDatabase[0]]}
                                        onChange={(selectedOptions: any): void => {
                                            dispatch(setSourceDatabase(selectedOptions));
                                        }}
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
                                        }}
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
