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

const SelectTarget = () => {
    const windowSize = useResize();
    const dispatch = useDispatch();

    const { target, isCreateSandboxPressed, source, aggregatedDbHostList } = useAppSelector(
        state => state.createSandbox
    );
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
                      item?.topology?.vpcId === selectedSourceDbHost?.data?.topology?.vpcId
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
        const hostName = ['default'];
        const options: optionType[] = [];
        hostName?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });

        return options;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => {
        if (
            selectedDatabaseHost === null &&
            selectedDatabaseInstance === null &&
            generateTargetName &&
            generateTargetInstance
        ) {
            dispatch(setTargetDbHost(generateTargetName[0]));
            dispatch(setTargetDbInstance(generateTargetInstance[0]));
        }
    }, [generateTargetName, generateTargetInstance]);
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
                        {GENERAL.TARGET_HOST}: {selectedDatabaseHost ? selectedDatabaseHost.label : ''}
                    </span>
                    <span className={CommonStyles.separatorSandbox} />
                    <span>
                        {GENERAL.TARGET_INSTANCE}: {selectedDatabaseInstance ? selectedDatabaseInstance.label : ''}
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
                title={<div className={CommonStyles.title}>{'Select Target'}</div>}
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
                                    defaultValue={selectedDatabaseHost ? selectedDatabaseHost : [generateTargetName[0]]}
                                    onChange={(selectedOptions: any): void => {
                                        dispatch(setTargetDbHost(selectedOptions));
                                    }}
                                    isSearchable={true}
                                    options={generateTargetName}
                                    className={styles.selectField}
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
                                            dispatch(setTargetDbInstance(e.target.value));
                                        }}
                                        label={GENERAL.TARGET_DATABASES}
                                        value={selectedDatabase}
                                        className={styles.keyField}
                                        error={!selectedDatabase ? GENERAL.ACTION_REQUIRED : ''}
                                    />
                                )}
                            </div>

                            {windowSize.width > 1500 && (
                                <div className={styles.secondRow}>
                                    <TextField
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            dispatch(setTargetDbInstance(e.target.value));
                                        }}
                                        label={GENERAL.TARGET_DATABASES}
                                        value={selectedDatabase}
                                        className={styles.keyField}
                                        error={!selectedDatabase ? GENERAL.ACTION_REQUIRED : ''}
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
