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
    setSelectedTargetDatabase,
    setSelectedTargetHost,
    setSelectedTargetInstance
} from '../../../../../store/workloadFactory/sandboxSlice';
import { GENERAL } from '../../../../../utils/appConstants';
import ActionRequired from '../../../../../common/ActionRequired/ActionRequired';

const SelectTarget = () => {
    const windowSize = useResize();
    const dispatch = useDispatch();

    const { selectedTargetHost, selectedTargetInstance, selectedTargetDatabase, isCreateSandboxPressed } =
        useAppSelector(state => state.sandbox);

    //Function to generate the options for Select Field
    const generateTargetName = useMemo<optionType[]>((): optionType[] => {
        const hostName = ['host name 1', 'host name 2', 'host name 3', 'host name 6', 'host name 4', 'host name 5'];
        const options: optionType[] = [];
        hostName?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });

        return options;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const generateTargetInstance = useMemo<optionType[]>((): optionType[] => {
        const hostName = ['instance 1', 'instance 1', '5instance 1', 'instance 4', 'instance 1', 'instance 8'];
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
            selectedTargetHost === null &&
            selectedTargetInstance === null &&
            generateTargetName &&
            generateTargetInstance
        ) {
            dispatch(setSelectedTargetHost(generateTargetName[0]));
            dispatch(setSelectedTargetInstance(generateTargetInstance[0]));
        }
    }, [generateTargetName, generateTargetInstance]);
    const setHeader = () => {
        if (!selectedTargetDatabase) {
            return (
                <div className={styles.actionRequired}>
                    <ActionRequired />
                </div>
            );
        } else {
            return (
                <DsTypography
                    variant="Regular_14"
                    title={`${selectedTargetHost ? selectedTargetHost.label : ''}, ${
                        selectedTargetInstance ? selectedTargetInstance.label : ''
                    }, ${selectedTargetDatabase ? selectedTargetDatabase : ''}`}
                    className={CommonStyles.setHeaderStyleSandbox}
                >
                    <span>Target host: {selectedTargetHost ? selectedTargetHost.label : ''}</span>
                    <span className={CommonStyles.separatorSandbox} />
                    <span>Target instance: {selectedTargetInstance ? selectedTargetInstance.label : ''}</span>
                    <span className={CommonStyles.separatorSandbox} />
                    <span className={styles.dbName}>Target database: {selectedTargetDatabase}</span>
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
                                <DsTypography variant="Regular_14">
                                    Notice: Destination host should be in the same VPC and FSxN instance as Source host
                                </DsTypography>
                            </div>
                            <div className={windowSize.width > 1500 ? styles.firstRow : styles.firstRowSmallScreen}>
                                <SelectField
                                    label={'Source host'}
                                    isClearable={false}
                                    defaultValue={selectedTargetHost ? selectedTargetHost : [generateTargetName[0]]}
                                    onChange={(selectedOptions: any): void => {
                                        dispatch(setSelectedTargetHost(selectedOptions));
                                    }}
                                    isSearchable={true}
                                    options={generateTargetName}
                                    className={styles.selectField}
                                />

                                <SelectField
                                    label={'Source Instance'}
                                    isClearable={false}
                                    defaultValue={
                                        selectedTargetInstance ? selectedTargetInstance : [generateTargetInstance[0]]
                                    }
                                    onChange={(selectedOptions: any): void => {
                                        dispatch(setSelectedTargetInstance(selectedOptions));
                                    }}
                                    isSearchable={true}
                                    options={generateTargetInstance}
                                    className={styles.selectField}
                                />

                                {windowSize.width <= 1500 && (
                                    <TextField
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            dispatch(setSelectedTargetDatabase(e.target.value));
                                        }}
                                        value={selectedTargetDatabase}
                                        className={styles.keyField}
                                        error={!selectedTargetDatabase ? GENERAL.ACTION_REQUIRED : ''}
                                    />
                                )}
                            </div>

                            {windowSize.width > 1500 && (
                                <div className={styles.secondRow}>
                                    <TextField
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            dispatch(setSelectedTargetDatabase(e.target.value));
                                        }}
                                        value={selectedTargetDatabase}
                                        className={styles.keyField}
                                        error={!selectedTargetDatabase ? GENERAL.ACTION_REQUIRED : ''}
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
