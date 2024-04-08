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
    setSelectedSourceDatabase,
    setSelectedSourceHost,
    setSelectedSourceInstance
} from '../../../../../store/workloadFactory/sandboxSlice';
import { GENERAL } from '../../../../../utils/appConstants';

const SelectSource = () => {
    const windowSize = useResize();
    const accordionContext = useAccordionContext()?.setOpenChildren!;
    const { isDBNameAdded, isMountPathAdded, isCreateSandboxPressed } = useAppSelector(state => state.sandbox);
    const { selectedSourceHost, selectedSourceInstance, selectedSourceDatabase } = useAppSelector(
        state => state.sandbox
    );
    const dispatch = useDispatch();

    useEffect(() => {
        // by default Select source accordion will be opened
        accordionContext({
            1: true
        });
    }, []);

    useEffect(() => {
        if (isCreateSandboxPressed && (!isDBNameAdded || isMountPathAdded)) {
            accordionContext({
                2: !isDBNameAdded ? true : false,
                3: !isMountPathAdded ? true : false
            });
            dispatch(setCreateSandboxPressed(false));
        }
    }, [accordionContext, isCreateSandboxPressed, isDBNameAdded, isMountPathAdded]);

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
    useEffect(() => {
        if (
            selectedSourceHost === null &&
            selectedSourceInstance === null &&
            selectedSourceDatabase === null &&
            generateSourceInstance &&
            generateSourceDatabase &&
            generateHostName
        ) {
            dispatch(setSelectedSourceHost(generateHostName[0]));
            dispatch(setSelectedSourceInstance(generateSourceInstance[0]));
            dispatch(setSelectedSourceDatabase(generateSourceDatabase[0]));
        }
    }, [generateSourceInstance, generateSourceDatabase, generateHostName]);
    const setHeader = () => {
        return (
            <DsTypography
                variant="Regular_14"
                title={`${selectedSourceHost ? selectedSourceHost.label : ''}, ${
                    selectedSourceInstance ? selectedSourceInstance.label : ''
                }, ${selectedSourceDatabase ? selectedSourceDatabase.label : ''}`}
                className={CommonStyles.setHeaderStyleSandbox}
            >
                <span>
                    {GENERAL.SOURCE_HOST}: {selectedSourceHost ? selectedSourceHost.label : ''}
                </span>
                <span className={CommonStyles.separatorSandbox} />
                <span>
                    {GENERAL.SOURCE_INSTANCE}: {selectedSourceInstance ? selectedSourceInstance.label : ''}
                </span>
                <span className={CommonStyles.separatorSandbox} />
                <span>
                    {GENERAL.SOURCE_DATABASE}: {selectedSourceDatabase ? selectedSourceDatabase.label : ''}
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
                title={<div className={CommonStyles.title}>{'Select source'}</div>}
            >
                <AccordionCardContent>
                    <DsTypography>
                        <>
                            <div className={windowSize.width > 1500 ? styles.firstRow : styles.firstRowSmallScreen}>
                                <SelectField
                                    label={GENERAL.SOURCE_HOST}
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
                                    label={GENERAL.SOURCE_INSTANCE}
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

                                {windowSize.width <= 1500 && (
                                    <SelectField
                                        label={GENERAL.SOURCE_DATABASE}
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
                                )}
                            </div>

                            {windowSize.width > 1500 && (
                                <div className={styles.secondRow}>
                                    <SelectField
                                        label={GENERAL.SOURCE_DATABASE}
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
                            )}
                        </>
                    </DsTypography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default SelectSource;
