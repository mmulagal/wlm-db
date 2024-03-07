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
import { formatSizeRoundOff, generateOptionType } from '../../../../../utils/utilityFunctions';

import styles from './FilesSize.module.scss';
import CommonStyles from '../../../../../utils/CommonStyles.module.scss';
import { GENERAL } from '../../../../../utils/appConstants';
import { DRIVE_LETTER_TYPE, GIB_IN_BYTE, TIB_IN_BYTE } from '../../../../../utils/consts';
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
    const [maxSize, setMaxSize] = useState<number | undefined>(undefined);

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

    const calculateRoundOffMaxSize = (value: any) => {
        let compareMaxSize = 0;
        let roundOffMaxSize = (value ? formatSizeRoundOff(value) : '').split(' ');
        if (roundOffMaxSize && roundOffMaxSize.length > 1) {
            if (roundOffMaxSize[1] === 'GiB') {
                compareMaxSize = Number(roundOffMaxSize[0]) * GIB_IN_BYTE;
            } else if (roundOffMaxSize[1] === 'TiB') {
                compareMaxSize = Number(roundOffMaxSize[0]) * TIB_IN_BYTE;
            } else {
                compareMaxSize = value || 0;
            }
        }
        setMaxSize(compareMaxSize);
    };

    useEffect(() => {
        if (driveLetter?.label2 === DRIVE_LETTER_TYPE.EXISTING && driveLetter?.data?.availableSize) {
            calculateRoundOffMaxSize(driveLetter?.data?.availableSize);
        } else if (driveLetter?.label2 === DRIVE_LETTER_TYPE.NEW && driveInfoList?.fsxStorageCapacity) {
            calculateRoundOffMaxSize(driveInfoList?.fsxStorageCapacity);
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
            currentSize = newUserDataSize * GIB_IN_BYTE;
        } else if (newUserDataSizeUnit?.label === 'TiB') {
            currentSize = newUserDataSize * TIB_IN_BYTE;
        }

        if (!currentSize || parseFloat(currentSize.toString()) < GIB_IN_BYTE) {
            dispatch(setIsDataSizeValid(false));
            return GENERAL.NO_DATA_SIZE_ERROR;
        } else if (maxSize && maxSize < GIB_IN_BYTE) {
            dispatch(setIsDataSizeValid(false));
            return GENERAL.DATA_SIZE_MIN_ERROR;
        } else if (maxSize && (currentSize < 1 || currentSize > maxSize)) {
            dispatch(setIsDataSizeValid(false));
            return `${GENERAL.DATA_SIZE_ERROR} ${formatSizeRoundOff(maxSize)}`;
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

        let currentSize = 0;
        if (newUserLogFileSizeUnit?.label === 'GiB') {
            currentSize = newUserLogFileSize * GIB_IN_BYTE;
        } else if (newUserLogFileSizeUnit?.label === 'TiB') {
            currentSize = newUserLogFileSize * TIB_IN_BYTE;
        }

        if (!currentSize || parseFloat(currentSize.toString()) < GIB_IN_BYTE) {
            dispatch(setIsLogSizeValid(false));
            return GENERAL.LOG_SIZE_MIN_ERROR;
        } else if (!logSizeValid) {
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
                                <DsTypography variant="Regular_14">{GENERAL.FILE_SIZE_TEXT[0]}</DsTypography>
                                <DsTypography variant="Regular_14">{GENERAL.FILE_SIZE_TEXT[1]}</DsTypography>
                            </div>
                        </div>

                        <div className={styles.dataSizeRow}>
                            <div className={styles.dataSizeField}>
                                <TextField
                                    ref={dataSizeRef}
                                    label="Data size"
                                    placeholder={maxSize ? `1 GiB - ${formatSizeRoundOff(maxSize)}` : ''}
                                    value={newUserDataSize}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        const numSize = e.target.value.replace(/[^0-9.]/g, '');
                                        dispatch(setNewUserDataSize(numSize));
                                    }}
                                    error={errorCheckForDataSize()}
                                    className={styles.textFieldNewUSer}
                                />

                                <SelectField
                                    label={'select'}
                                    isClearable={false}
                                    info={
                                        maxSize &&
                                        maxSize >= GIB_IN_BYTE && (
                                            <div className={styles.dataSizeTooltip}>
                                                <div>
                                                    {GENERAL.DATA_SIZE_TOOLTIP[0]}
                                                    <span className={styles.bold}>{dbHostName}</span>
                                                    {GENERAL.DATA_SIZE_TOOLTIP[1]}
                                                </div>
                                                <DsTypography variant="Regular_13">{`1 GiB - ${formatSizeRoundOff(
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
                                        const numSize = e.target.value.replace(/[^0-9.]/g, '');
                                        dispatch(setNewUserLogFileSize(numSize));
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
