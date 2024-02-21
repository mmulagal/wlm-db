import { AccordionCard, AccordionCardContent, DsTypography, TextField } from '@netapp/design-system';
import ActionRequired from '../../../../../common/ActionRequired/ActionRequired';

import { useAppSelector } from '../../../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import {
    setIsDataSizeValid,
    setIsLogSizeValid,
    setNewUserDataSize,
    setNewUserDataSizeUnit,
    setNewUserLogFileSize,
    setNewUserLogFileSizeUnit
} from '../../../../../store/workloadFactory/createNewDBSlice';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SelectField, optionType } from '@netapp/design-system/dist/components/Select';
import { formatSize, generateOptionType } from '../../../../../utils/utilityFunctions';

import styles from './FilesSize.module.scss';
import CommonStyles from '../../../../../utils/CommonStyles.module.scss';
import { GENERAL } from '../../../../../utils/appConstants';
import { DRIVE_LETTER_TYPE } from '../../../../../utils/consts';
import AccordionError from '../../../../../common/AccordionError/AccordionError';

const FilesSize = () => {
    const dispatch = useDispatch();

    const dataSizeRef = useRef(null);
    const logSizeRef = useRef(null);

    const {
        newUserDataSize,
        newUserDataSizeUnit,
        newUserLogFileSize,
        newUserLogFileSizeUnit,
        driveInfoList,
        driveLetter
    } = useAppSelector(state => state.createNewUser);
    const isDbCreateHit = useAppSelector(state => state.msSqlAction.isDbCreateHit);
    const dbCreateDataSizeValid = useAppSelector(state => state.msSqlAction.dbCreateDataSizeValid);
    const dbCreateLogSizeValid = useAppSelector(state => state.msSqlAction.dbCreateLogSizeValid);

    const dbHostName = useAppSelector(state => state.createNewUser.dbHostName);

    const units = ['GiB', 'TiB'];
    const [maxSize, setMaxSize] = useState(undefined);

    useEffect(() => {
        if (isDbCreateHit) {
            if (!dbCreateDataSizeValid) {
                setTimeout(() => {
                    //@ts-ignore
                    dataSizeRef?.current?.focus();
                }, 80);
            }
            if (!dbCreateLogSizeValid) {
                setTimeout(() => {
                    //@ts-ignore
                    logSizeRef?.current?.focus();
                }, 70);
            }
        }
    }, [dbCreateDataSizeValid, dbCreateLogSizeValid, isDbCreateHit]);

    useEffect(() => {
        if (driveLetter?.label2 === DRIVE_LETTER_TYPE.EXISTING && driveLetter?.data?.availableSize) {
            setMaxSize(driveLetter?.data?.availableSize);
        } else if (driveLetter?.label2 === DRIVE_LETTER_TYPE.NEW && driveInfoList?.fsxStorageCapacity) {
            setMaxSize(driveInfoList?.fsxStorageCapacity);
        } else {
            setMaxSize(undefined);
        }
    }, [driveLetter]);

    //Function to generate the options for Select Field
    const generateUnitsForStorage = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        units?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });
        return options;
    }, []);

    useEffect(() => {
        dispatch(setNewUserDataSize(1));
        dispatch(setNewUserLogFileSize(1));
        dispatch(setNewUserDataSizeUnit(generateUnitsForStorage[0]));
        dispatch(setNewUserLogFileSizeUnit(generateUnitsForStorage[0]));
    }, [generateUnitsForStorage]);

    useEffect(() => {
        if (newUserDataSize) {
            if (newUserDataSizeUnit?.label === 'GiB' && newUserDataSize > 0) {
                const logFileSize = newUserDataSize / 4;
                dispatch(setNewUserLogFileSize(logFileSize > 1 ? logFileSize : 1));
                dispatch(setNewUserLogFileSizeUnit(generateOptionType('GiB', 'GiB', '', false, '')));
            }

            if (newUserDataSizeUnit?.label === 'TiB' && newUserDataSize > 0) {
                const logFileSize = newUserDataSize / 4;
                dispatch(setNewUserLogFileSize(logFileSize));
                dispatch(setNewUserLogFileSizeUnit(generateOptionType('TiB', 'TiB', '', false, '')));
            }
        }
    }, [newUserDataSize, newUserDataSizeUnit]);
    //Set the Header text here
    const setHeader = () => {
        if (newUserDataSize && newUserDataSizeUnit?.label && newUserLogFileSize && newUserLogFileSizeUnit?.label) {
            if (errorCheckForDataSize() || errorCheckForLogSize()) {
                return <AccordionError />;
            } else {
                return (
                    <DsTypography variant="Regular_14" className={CommonStyles.setHeaderStyle}>
                        <DsTypography variant="Regular_14">
                            {`${GENERAL.DATA_FILE_SIZE} ${newUserDataSize} ${newUserDataSizeUnit?.label}`}{' '}
                        </DsTypography>
                        <div className={CommonStyles.separator} />
                        <DsTypography variant="Regular_14">
                            {`${GENERAL.LOG_FILE_SIZE} ${newUserLogFileSize} ${newUserLogFileSizeUnit?.label}`}{' '}
                        </DsTypography>
                    </DsTypography>
                );
            }
        }
        return <ActionRequired error={!dbCreateDataSizeValid || !dbCreateLogSizeValid ? true : false} />;
    };

    const errorCheckForDataSize = () => {
        let currentSize = 0;
        if (newUserDataSizeUnit?.label === 'GiB') {
            currentSize = newUserDataSize * 1024 * 1024 * 1024;
        } else if (newUserDataSizeUnit?.label === 'TiB') {
            currentSize = newUserDataSize * 1024 * 1024 * 1024 * 1024;
        }

        if (maxSize && currentSize && (currentSize < 0 || currentSize > maxSize)) {
            dispatch(setIsDataSizeValid(false));
            return `${GENERAL.DATA_SIZE_ERROR} ${formatSize(maxSize)}`;
        } else {
            dispatch(setIsDataSizeValid(true));
        }
    };

    const errorCheckForLogSize = () => {
        let logSizeValid = true;
        if (newUserDataSize && newUserLogFileSize) {
            if (newUserDataSizeUnit?.value === newUserLogFileSizeUnit?.value) {
                if (newUserLogFileSize > newUserDataSize) {
                    logSizeValid = false;
                }
            } else {
                if (newUserDataSizeUnit?.value === 'TiB') {
                    if (newUserLogFileSize > newUserDataSize * 1024) {
                        logSizeValid = false;
                    }
                } else {
                    if (newUserLogFileSize * 1024 > newUserDataSize) {
                        logSizeValid = false;
                    }
                }
            }
        }
        if (!logSizeValid) {
            dispatch(setIsLogSizeValid(false));
            return GENERAL.LOG_SIZE_ERROR;
        } else {
            dispatch(setIsLogSizeValid(true));
        }
    };

    return (
        <div className={styles.filesSize}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="4"
                title={<div className={CommonStyles.title}>{GENERAL.DB_CREATE_FILES_SIZE}</div>}
            >
                <AccordionCardContent>
                    <DsTypography>
                        <div className={styles.textSection}>
                            <div className={styles.firstSection}>
                                <DsTypography variant="Regular_14">{GENERAL.FILE_SIZE_TEXT}</DsTypography>
                            </div>
                        </div>

                        <div className={styles.dataSizeRow}>
                            <div className={styles.dataSizeField}>
                                <TextField
                                    ref={dataSizeRef}
                                    label="Data size"
                                    placeholder={maxSize ? `1 GiB - ${formatSize(maxSize)}` : ''}
                                    value={newUserDataSize}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        const numSize = e.target.value.replace(/\D/g, '');
                                        dispatch(setNewUserDataSize(numSize));
                                    }}
                                    error={errorCheckForDataSize()}
                                    className={styles.textFieldNewUSer}
                                />

                                <SelectField
                                    label={'select'}
                                    isClearable={false}
                                    info={
                                        maxSize && (
                                            <div className={styles.dataSizeTooltip}>
                                                <DsTypography variant="Regular_13">{`Host ${dbHostName} data size range is 1 GiB - ${formatSize(
                                                    maxSize
                                                )}.`}</DsTypography>
                                            </div>
                                        )
                                    }
                                    defaultValue={
                                        newUserDataSizeUnit ? [newUserDataSizeUnit] : [generateUnitsForStorage[0]]
                                    }
                                    onChange={(selectedOptions: any): void => {
                                        dispatch(setNewUserDataSizeUnit(selectedOptions));
                                    }}
                                    isSearchable={generateUnitsForStorage.length > 5}
                                    error={errorCheckForDataSize()}
                                    options={generateUnitsForStorage}
                                    className={styles.selectField}
                                />
                            </div>

                            <div className={styles.dataSizeField}>
                                <TextField
                                    ref={logSizeRef}
                                    label="Log size"
                                    placeholder="25% of the data size"
                                    value={newUserLogFileSize}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        dispatch(setNewUserLogFileSize(e.target.value));
                                    }}
                                    className={styles.textFieldNewUSer}
                                    error={errorCheckForLogSize()}
                                />

                                <SelectField
                                    label={'select'}
                                    isClearable={false}
                                    value={
                                        newUserLogFileSizeUnit ? [newUserLogFileSizeUnit] : [generateUnitsForStorage[0]]
                                    }
                                    onChange={(selectedOptions: any): void => {
                                        dispatch(setNewUserLogFileSizeUnit(selectedOptions));
                                    }}
                                    isSearchable={generateUnitsForStorage.length > 5}
                                    options={generateUnitsForStorage}
                                    className={styles.selectField}
                                    error={errorCheckForLogSize()}
                                />
                            </div>
                        </div>
                    </DsTypography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default FilesSize;
