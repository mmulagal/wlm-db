import { useMemo } from 'react';

import { AccordionCard, AccordionCardContent, DsTypography, SelectField } from '@netapp/design-system';
import { optionType } from '@netapp/design-system/dist/components/Select';
import styles from './SelectSource.module.scss';
import CommonStyles from '../../../../../utils/CommonStyles.module.scss';
import { generateOptionType } from '../../../../../utils/utilityFunctions';
import useResize from '../../../../../common/hooks/useResize';
import { useAppSelector } from '../../../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import {
    setSelectedSourceDatabase,
    setSelectedSourceHost,
    setSelectedSourceInstance
} from '../../../../../store/workloadFactory/sandboxSlice';

const SelectSource = () => {
    const windowSize = useResize();
    const { selectedSourceHost, selectedSourceInstance, selectedSourceDatabase } = useAppSelector(
        state => state.sandbox
    );
    const dispatch = useDispatch();
    //Function to generate the options for Select Field
    const generateHostName = useMemo<optionType[]>((): optionType[] => {
        const hostName = ['host name 1', 'host name 2', 'host name 3', 'host name 6', 'host name 4', 'host name 5'];
        const options: optionType[] = [];
        hostName?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });

        return options;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const generateSourceInstance = useMemo<optionType[]>((): optionType[] => {
        const hostName = ['instance 1', 'instance 1', '5instance 1', 'instance 4', 'instance 1', 'instance 8'];
        const options: optionType[] = [];
        hostName?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });

        return options;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const generateSourceDatabase = useMemo<optionType[]>((): optionType[] => {
        const hostName = ['db 1', 'db 2', 'db 3', 'db 4s', 'db 5', 'db 6'];
        const options: optionType[] = [];
        hostName?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });

        return options;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const setHeader = () => {
        return (
            <DsTypography variant="Regular_14" className={CommonStyles.setHeaderStyle}>
                <div>{'Source host: host name'}</div>
                <div className={CommonStyles.separator} />
                <div>Source instance: instance name</div>
                <div className={CommonStyles.separator} />
                <div>Source database: database name</div>
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
                title={<div className={CommonStyles.title}>{'Select source'}</div>}
            >
                <AccordionCardContent>
                    <DsTypography>
                        {windowSize.width > 1500 && (
                            <>
                                <div className={styles.firstRow}>
                                    <SelectField
                                        label={'Source host'}
                                        isClearable={false}
                                        defaultValue={selectedSourceHost ? selectedSourceHost : [generateHostName[0]]}
                                        onChange={(selectedOptions: any): void => {
                                            dispatch(setSelectedSourceHost(selectedOptions));
                                        }}
                                        isSearchable={true}
                                        options={generateHostName}
                                        className={styles.selectField}
                                    />

                                    <SelectField
                                        label={'Source Instance'}
                                        isClearable={false}
                                        defaultValue={
                                            selectedSourceInstance
                                                ? selectedSourceInstance
                                                : [generateSourceInstance[0]]
                                        }
                                        onChange={(selectedOptions: any): void => {
                                            dispatch(setSelectedSourceInstance(selectedOptions));
                                        }}
                                        isSearchable={true}
                                        options={generateSourceInstance}
                                        className={styles.selectField}
                                    />
                                </div>

                                <div className={styles.secondRow}>
                                    <SelectField
                                        label={'Source database'}
                                        isClearable={false}
                                        defaultValue={
                                            selectedSourceDatabase
                                                ? selectedSourceDatabase
                                                : [generateSourceDatabase[0]]
                                        }
                                        onChange={(selectedOptions: any): void => {
                                            dispatch(setSelectedSourceDatabase(selectedOptions));
                                        }}
                                        isSearchable={true}
                                        options={generateSourceDatabase}
                                        className={styles.selectField}
                                    />
                                </div>
                            </>
                        )}

                        {windowSize.width <= 1500 && (
                            <div className={styles.smallFirstRow}>
                                <SelectField
                                    label={'Source host'}
                                    isClearable={false}
                                    defaultValue={selectedSourceHost ? selectedSourceHost : [generateHostName[0]]}
                                    onChange={(selectedOptions: any): void => {
                                        dispatch(setSelectedSourceHost(selectedOptions));
                                    }}
                                    isSearchable={true}
                                    options={generateHostName}
                                    className={styles.selectField}
                                />

                                <SelectField
                                    label={'Source Instance'}
                                    isClearable={false}
                                    defaultValue={
                                        selectedSourceInstance ? selectedSourceInstance : [generateSourceInstance[0]]
                                    }
                                    onChange={(selectedOptions: any): void => {
                                        dispatch(setSelectedSourceInstance(selectedOptions));
                                    }}
                                    isSearchable={true}
                                    options={generateSourceInstance}
                                    className={styles.selectField}
                                />

                                <SelectField
                                    label={'Source database'}
                                    isClearable={false}
                                    defaultValue={
                                        selectedSourceDatabase ? selectedSourceDatabase : [generateSourceDatabase[0]]
                                    }
                                    onChange={(selectedOptions: any): void => {
                                        dispatch(setSelectedSourceDatabase(selectedOptions));
                                    }}
                                    isSearchable={true}
                                    options={generateSourceDatabase}
                                    className={styles.selectField}
                                />
                            </div>
                        )}
                    </DsTypography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default SelectSource;
