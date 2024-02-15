import { AccordionCard, AccordionCardContent, DsTypography, TextField } from '@netapp/design-system';

import ActionRequired from '../../../../common/ActionRequired/ActionRequired';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';

import { useAppSelector } from '../../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import {
    setNewUserDataSize,
    setNewUserDataSizeUnit,
    setNewDBFileName,
    setNewUserLogFileName,
    setNewUserLogFileSize,
    setNewUserLogFileSizeUnit,
    setDriveLetter,
    setDriveLetterForLogFile
} from '../../../../store/workloadFactory/createNewDBSlice';
import { useEffect, useMemo, useState } from 'react';
import { SelectField, optionType } from '@netapp/design-system/dist/components/Select';
import { generateOptionType } from '../../../../utils/utilityFunctions';

import styles from './FileSettings.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { GENERAL } from '../../../../utils/appConstants';

const FileSettings = () => {
    const dispatch = useDispatch();

    const {
        newUserDataSize,
        newUserDataSizeUnit,
        newUserDBFileName,
        newUserLogFileName,
        newUserLogFileSize,
        newUserLogFileSizeUnit,
        selectedNewUserConfig,
        driveLetter,
        driveLetterLogFile,
        newUserDBName
    } = useAppSelector(state => state.createNewUser);

    const units = ['GiB', 'TiB'];
    const [maxSize, setMaxSize] = useState(130);
    const [dataFilePath, setDataFilePath] = useState('');
    const [logFilePath, setLogFilePath] = useState('');

    useEffect(() => {
        if (driveLetter && newUserDBFileName) {
            setDataFilePath(`${driveLetter?.value}:\\mssql\\data\\${newUserDBFileName}.mdf`);
        } else if (driveLetter) {
            setDataFilePath(`${driveLetter?.value}:\\mssql\\data\\<db_data>.mdf`);
        } else {
            setDataFilePath('');
        }
    }, [driveLetter, newUserDBFileName]);

    useEffect(() => {
        if (driveLetterLogFile && newUserLogFileName) {
            setLogFilePath(`${driveLetterLogFile?.value}:\\mssql\\log\\${newUserLogFileName}.ldf`);
        } else if (driveLetterLogFile) {
            setLogFilePath(`${driveLetterLogFile?.value}:\\mssql\\log\\<db_log>.ldf`);
        } else {
            setLogFilePath('');
        }
    }, [driveLetterLogFile, newUserLogFileName]);

    useEffect(() => {
        if (newUserDBName) {
            const newDBName = `${newUserDBName}_data`;
            const newLogName = `${newUserDBName}_log`;
            dispatch(setNewDBFileName(newDBName));
            dispatch(setNewUserLogFileName(newLogName));
        }
    }, [newUserDBName]);

    //Function to generate the options for Select Field
    const generateUnitsForStorage = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        units?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });
        return options;
    }, []);

    //Function to generate the options for Select Field
    const generateDataDriveLetters = useMemo<optionType[]>((): optionType[] => {
        const letters = [
            { drive: 'a', existing: true },
            { drive: 'b', existing: true },
            { drive: 'c', existing: true },
            { drive: 'd' },
            { drive: 'e' },
            { drive: 'f' }
        ];
        const options: optionType[] = [];
        letters?.map((val, idx: number) => {
            const option = generateOptionType(
                val.drive,
                val.drive,
                val?.existing ? 'Existing drive letter' : 'New drive letter',
                false,
                ''
            );
            options.push(option);
        });
        return options;
    }, []);

    //Function to generate the options for Select Field
    const generateLogDriveLetters = useMemo<optionType[]>((): optionType[] => {
        const letters = [
            { drive: 'a', existing: true },
            { drive: 'b', existing: true },
            { drive: 'c', existing: true },
            { drive: 'd' },
            { drive: 'e' },
            { drive: 'f' }
        ];
        const options: optionType[] = [];
        letters?.map((val, idx: number) => {
            const option = generateOptionType(
                val.drive,
                val.drive,
                val?.existing ? 'Existing drive letter' : 'New drive letter',
                false,
                ''
            );
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

            if (newUserDataSizeUnit?.label === 'TiB' && newUserDataSize < maxSize) {
                const logFileSize = newUserDataSize / 4;
                dispatch(setNewUserLogFileSize(logFileSize));
                dispatch(setNewUserLogFileSizeUnit(generateOptionType('TiB', 'TiB', '', false, '')));
            }
        }
    }, [newUserDataSize]);
    //Set the Header text here
    const setHeader = () => {
        if (
            newUserDataSize &&
            newUserDataSizeUnit?.label &&
            newUserDBFileName &&
            newUserLogFileName &&
            newUserLogFileSize &&
            newUserLogFileSizeUnit?.label
        ) {
            return (
                <DsTypography variant="Regular_14" className={CommonStyles.setHeaderStyle}>
                    <DsTypography variant="Regular_14">
                        {`Data file name: ${newUserDBFileName} (${newUserDataSize} ${newUserDataSizeUnit?.label})`}{' '}
                    </DsTypography>
                    <div className={CommonStyles.separator} />
                    <DsTypography variant="Regular_14">
                        {`Log file name: ${newUserLogFileName} (${newUserLogFileSize} ${newUserLogFileSizeUnit?.label})`}{' '}
                    </DsTypography>
                </DsTypography>
            );
        }
        return <ActionRequired error={false} />;
    };

    const errorCheckForDataSize = () => {
        if (newUserDataSizeUnit?.label === 'GiB') {
            if (newUserDataSize && (newUserDataSize < 0 || newUserDataSize > maxSize * 1024)) {
                return `The valid range is 1 GiB - ${maxSize} TiB`;
            }
        } else if (newUserDataSizeUnit?.label === 'TiB') {
            if (newUserDataSize && newUserDataSize > maxSize) {
                return `The valid range is 1 GiB - ${maxSize} TiB`;
            }
        }
    };

    return (
        <div className={styles.fileSettings}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="2"
                title={<div className={CommonStyles.title}>{'File  settings'}</div>}
            >
                <AccordionCardContent>
                    <DsTypography>
                        {selectedNewUserConfig === 'Quick create' && (
                            <>
                                <div className={styles.firstRow}>
                                    <TextField
                                        label="Data file name"
                                        placeholder="Database file name"
                                        value={newUserDBFileName}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            dispatch(setNewDBFileName(e.target.value));
                                        }}
                                        className={styles.fileNameText}
                                    />
                                    <div className={styles.dataSizeField}>
                                        <TextField
                                            label="Data size"
                                            placeholder={`1 GiB -  ${maxSize} TiB`}
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
                                            info={
                                                <div className={styles.dataSizeTooltip}>
                                                    <DsTypography variant="Regular_13">
                                                        {GENERAL.DATA_SIZE_TOOLTIP}
                                                    </DsTypography>
                                                    <DsTypography variant="Regular_13">{`Host hostname data size name is 1 GiB - ${maxSize} TiB.`}</DsTypography>
                                                </div>
                                            }
                                            isClearable={false}
                                            defaultValue={
                                                newUserDataSizeUnit
                                                    ? [newUserDataSizeUnit]
                                                    : [generateUnitsForStorage[0]]
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
                                </div>

                                <div className={styles.firstRow}>
                                    <TextField
                                        label="Log file name"
                                        placeholder="Log file name"
                                        value={newUserLogFileName}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            dispatch(setNewUserLogFileName(e.target.value));
                                        }}
                                        className={styles.fileNameText}
                                    />
                                    <div className={styles.dataSizeField}>
                                        <TextField
                                            label="Log size"
                                            placeholder="25% of the data size"
                                            value={newUserLogFileSize}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                dispatch(setNewUserLogFileSize(e.target.value));
                                            }}
                                            className={styles.textFieldNewUSer}
                                        />

                                        <SelectField
                                            label={'select'}
                                            isClearable={false}
                                            info={
                                                <div className={styles.logSizeTooltip}>
                                                    <DsTypography variant="Regular_13">
                                                        {GENERAL.LOG_SIZE_TOOLTIP[0]}
                                                    </DsTypography>
                                                    <DsTypography variant="Regular_13">
                                                        {GENERAL.LOG_SIZE_TOOLTIP[1]}
                                                    </DsTypography>
                                                </div>
                                            }
                                            defaultValue={
                                                newUserLogFileSizeUnit
                                                    ? [newUserLogFileSizeUnit]
                                                    : [generateUnitsForStorage[0]]
                                            }
                                            value={
                                                newUserLogFileSizeUnit
                                                    ? [newUserLogFileSizeUnit]
                                                    : [generateUnitsForStorage[0]]
                                            }
                                            onChange={(selectedOptions: any): void => {
                                                dispatch(setNewUserLogFileSizeUnit(selectedOptions));
                                            }}
                                            isSearchable={generateUnitsForStorage.length > 5}
                                            options={generateUnitsForStorage}
                                            className={styles.selectField}
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Advanced Create Logic */}
                        {selectedNewUserConfig === 'Advanced create' && (
                            <>
                                <div className={styles.textSection}>
                                    <div className={styles.firstSection}>
                                        <Bullet />
                                        <DsTypography variant="Regular_14">
                                            {GENERAL.FILE_SETTINGS_FIRST_TEXT}
                                        </DsTypography>
                                    </div>
                                    <div className={styles.firstSection}>
                                        <Bullet />
                                        <DsTypography variant="Regular_14">
                                            {GENERAL.FILE_SETTINGS_SECOND_TEXT}
                                        </DsTypography>
                                    </div>
                                </div>
                                <div className={styles.dataFileSection}>
                                    <DsTypography variant="Regular_14">Data file</DsTypography>
                                    <div className={styles.dataFileSeparator} />
                                    <div className={styles.inputSection}>
                                        <SelectField
                                            label="Select drive letter"
                                            isClearable={false}
                                            placeholder="Select drive letter"
                                            onChange={(selectedOptions: any): void => {
                                                dispatch(setDriveLetter(selectedOptions));
                                            }}
                                            value={driveLetter ? driveLetter : null}
                                            isSearchable={generateDataDriveLetters.length > 5}
                                            options={generateDataDriveLetters}
                                            variant="two-lines"
                                            className={styles.driveSelectField}
                                        />

                                        <div className={styles.firstRow}>
                                            <TextField
                                                label="Data file name"
                                                placeholder="Database file name"
                                                value={newUserDBFileName}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                    dispatch(setNewDBFileName(e.target.value));
                                                }}
                                                className={styles.fileNameText}
                                            />
                                            <div className={styles.dataSizeField}>
                                                <TextField
                                                    label="Data size"
                                                    placeholder={`1 GiB - ${maxSize} TiB`}
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
                                                        <div className={styles.dataSizeTooltip}>
                                                            <DsTypography variant="Regular_13">
                                                                {GENERAL.DATA_SIZE_TOOLTIP}
                                                            </DsTypography>
                                                            <DsTypography variant="Regular_13">{`Host hostname data size name is 1 GiB - ${maxSize} TiB.`}</DsTypography>
                                                        </div>
                                                    }
                                                    defaultValue={
                                                        newUserDataSizeUnit
                                                            ? [newUserDataSizeUnit]
                                                            : [generateUnitsForStorage[0]]
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
                                        </div>
                                    </div>
                                    <div className={styles.pathSection}>
                                        <DsTypography variant="Semibold_14">{`Data file path: ${dataFilePath}`}</DsTypography>
                                    </div>
                                </div>

                                <div className={styles.dataFileSection}>
                                    <DsTypography variant="Regular_14">Log file</DsTypography>
                                    <div className={styles.dataFileSeparator} />
                                    <div className={styles.inputSection}>
                                        <SelectField
                                            label="Select drive letter"
                                            isClearable={false}
                                            placeholder="Select drive letter"
                                            onChange={(selectedOptions: any): void => {
                                                dispatch(setDriveLetterForLogFile(selectedOptions));
                                            }}
                                            value={driveLetterLogFile ? driveLetterLogFile : null}
                                            isSearchable={generateLogDriveLetters.length > 5}
                                            options={generateLogDriveLetters}
                                            variant="two-lines"
                                            className={styles.driveSelectField}
                                        />

                                        <div className={styles.firstRow}>
                                            <TextField
                                                label="Log file name"
                                                placeholder="Log file name"
                                                value={newUserLogFileName}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                    dispatch(setNewUserLogFileName(e.target.value));
                                                }}
                                                className={styles.fileNameText}
                                            />
                                            <div className={styles.dataSizeField}>
                                                <TextField
                                                    label="Log size"
                                                    placeholder="25% of the data size"
                                                    value={newUserLogFileSize}
                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                        dispatch(setNewUserLogFileSize(e.target.value));
                                                    }}
                                                    className={styles.textFieldNewUSer}
                                                />

                                                <SelectField
                                                    label={'select'}
                                                    isClearable={false}
                                                    info={
                                                        <div className={styles.logSizeTooltip}>
                                                            <DsTypography variant="Regular_13">
                                                                {GENERAL.LOG_SIZE_TOOLTIP[0]}
                                                            </DsTypography>
                                                            <DsTypography variant="Regular_13">
                                                                {GENERAL.LOG_SIZE_TOOLTIP[1]}
                                                            </DsTypography>
                                                        </div>
                                                    }
                                                    defaultValue={
                                                        newUserLogFileSizeUnit
                                                            ? [newUserLogFileSizeUnit]
                                                            : [generateUnitsForStorage[0]]
                                                    }
                                                    onChange={(selectedOptions: any): void => {
                                                        dispatch(setNewUserLogFileSizeUnit(selectedOptions));
                                                    }}
                                                    isSearchable={generateUnitsForStorage.length > 5}
                                                    options={generateUnitsForStorage}
                                                    className={styles.selectField}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.pathSection}>
                                        <DsTypography variant="Semibold_14">{`Log file path: ${logFilePath}`}</DsTypography>
                                    </div>
                                </div>
                            </>
                        )}
                    </DsTypography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default FileSettings;
