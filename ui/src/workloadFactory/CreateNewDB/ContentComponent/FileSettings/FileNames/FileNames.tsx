import {
    AccordionCard,
    AccordionCardContent,
    DsCheckbox,
    DsTypography,
    TextField,
    TooltipInfo
} from '@netapp/design-system';
import ActionRequired from '../../../../../common/ActionRequired/ActionRequired';

import { useAppSelector } from '../../../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import {
    setNewDBFileName,
    setNewUserLogFileName,
    setDriveLetter,
    setDriveLetterForLogFile,
    setIsExistingDataDrive,
    setIsExistingLogDrive,
    setIsDataVirtualMountPoint,
    setIsLogVirtualMountPoint
} from '../../../../../store/workloadFactory/createNewDBSlice';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SelectField, optionType } from '@netapp/design-system/dist/components/Select';
import { generateOptionType, sortListOfDict } from '../../../../../utils/utilityFunctions';

import styles from './FileNames.module.scss';
import CommonStyles from '../../../../../utils/CommonStyles.module.scss';
import { GENERAL } from '../../../../../utils/appConstants';
import { DRIVE_LETTER_TYPE } from '../../../../../utils/consts';
import { ReactComponent as Bullet } from '../../../../../assets/ic_bullet.svg';
import { isValidFileName } from '../../../CreateNewDBFooter/createUserDBPayload';
import { useDelayedError } from '../../../../../common/hooks/useDelayedError';
import AccordionError from '../../../../../common/AccordionError/AccordionError';

const FileNames = () => {
    const dispatch = useDispatch();

    const dataNameRef = useRef(null);
    const logNameRef = useRef(null);

    const {
        newUserDBFileName,
        newUserLogFileName,
        selectedNewUserConfig,
        driveLetter,
        driveLetterLogFile,
        newUserDBName,
        driveInfoList,
        driveInfoListLoading,
        isDataVirtualMountPoint,
        isLogVirtualMountPoint
    } = useAppSelector(state => state.createNewUser);
    const isDbCreateHit = useAppSelector(state => state.msSqlAction.isDbCreateHit);
    const dbCreateDataNameAdded = useAppSelector(state => state.msSqlAction.dbCreateDataNameAdded);
    const dbCreateLogNameAdded = useAppSelector(state => state.msSqlAction.dbCreateLogNameAdded);
    const isDemoMode = useAppSelector(state => state.auth?.isDemoMode);
    const [dataFileNameChange, setDataFileNameChange] = useState(false);
    const [logFileNameChange, setLogFileNameChange] = useState(false);

    const [dataFilePath, setDataFilePath] = useState('');
    const [logFilePath, setLogFilePath] = useState('');

    useEffect(() => {
        if (isDbCreateHit) {
            if (!dbCreateDataNameAdded) {
                setTimeout(() => {
                    //@ts-ignore
                    dataNameRef?.current?.focus();
                }, 100);
            }
            if (!dbCreateLogNameAdded) {
                setTimeout(() => {
                    //@ts-ignore
                    logNameRef?.current?.focus();
                }, 90);
            }
        }
    }, [dbCreateDataNameAdded, dbCreateLogNameAdded, isDbCreateHit]);

    useEffect(() => {
        if (driveLetter && newUserDBFileName) {
            setDataFilePath(
                `${driveLetter?.value}:${
                    isDataVirtualMountPoint ? `${newUserDBName}_data` : ''
                }\\mssql\\data\\${newUserDBFileName}.mdf`
            );
        } else if (driveLetter) {
            setDataFilePath(
                `${driveLetter?.value}:${
                    isDataVirtualMountPoint ? `${newUserDBName}_data` : ''
                }\\mssql\\data\\<db_data>.mdf`
            );
        } else {
            setDataFilePath('');
        }
    }, [driveLetter, newUserDBFileName, newUserDBName]);

    useEffect(() => {
        if (driveLetterLogFile && newUserLogFileName) {
            setLogFilePath(
                `${driveLetterLogFile?.value}:${
                    isLogVirtualMountPoint ? `${newUserDBName}_log` : ''
                }\\mssql\\log\\${newUserLogFileName}.ldf`
            );
        } else if (driveLetterLogFile) {
            setLogFilePath(
                `${driveLetterLogFile?.value}:${
                    isLogVirtualMountPoint ? `${newUserDBName}_log` : ''
                }\\mssql\\log\\<db_log>.ldf`
            );
        } else {
            setLogFilePath('');
        }
    }, [driveLetterLogFile, newUserLogFileName]);

    useEffect(() => {
        if (newUserDBName && !dataFileNameChange) {
            const newDBName = `${newUserDBName}_data`;
            dispatch(setNewDBFileName(newDBName));
        }
        if (newUserDBName && !logFileNameChange) {
            const newLogName = `${newUserDBName}_log`;
            dispatch(setNewUserLogFileName(newLogName));
        }
    }, [newUserDBName]);

    const disableDriveMsg = (val: any) => {
        if (!val?.isNetappDrive) {
            return GENERAL.NON_NETAPP_DRIVE;
        } else if ('isDriveClustered' in val ? !val.isDriveClustered : false) {
            return GENERAL.NON_CLUSTERED_DRIVE;
        }
        return '';
    };

    //Function to generate the options for data drive Select Field
    const generateDataDriveLetters = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        driveInfoList?.existingDriveInfo?.map((val: any, idx: number) => {
            const option = generateOptionType(
                val?.driveLetter,
                val?.driveLetter,
                DRIVE_LETTER_TYPE.EXISTING,
                !val?.isNetappDrive || ('isDriveClustered' in val ? !val.isDriveClustered : false),
                disableDriveMsg(val),
                val
            );
            options.push(option);
        });
        driveInfoList?.availableDriveLetters?.map((val: any, idx: number) => {
            const option = generateOptionType(
                val,
                val,
                DRIVE_LETTER_TYPE.NEW,
                driveLetterLogFile?.value === val ? true : false,
                driveLetterLogFile?.value === val ? GENERAL.SAME_NEW_DRIVE_ERROR : ''
            );
            options.push(option);
        });
        return sortListOfDict(options, 'isDisabled');
    }, [driveInfoList, driveLetterLogFile]);

    //Function to generate the options for log file Select Field
    const generateLogDriveLetters = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        driveInfoList?.existingDriveInfo?.map((val: any, idx: number) => {
            const option = generateOptionType(
                val?.driveLetter,
                val?.driveLetter,
                DRIVE_LETTER_TYPE.EXISTING,
                !val?.isNetappDrive || ('isDriveClustered' in val ? !val.isDriveClustered : false),
                disableDriveMsg(val),
                val
            );
            options.push(option);
        });
        driveInfoList?.availableDriveLetters?.map((val: any, idx: number) => {
            const option = generateOptionType(
                val,
                val,
                DRIVE_LETTER_TYPE.NEW,
                driveLetter?.value === val ? true : false,
                driveLetter?.value === val ? GENERAL.SAME_NEW_DRIVE_ERROR : ''
            );
            options.push(option);
        });
        return sortListOfDict(options, 'isDisabled');
    }, [driveInfoList, driveLetter]);

    const isVirtualMountPointDisabled = useMemo(() => {
        return driveLetter?.label2 === DRIVE_LETTER_TYPE.NEW || driveLetterLogFile?.label2 === DRIVE_LETTER_TYPE.NEW;
    }, [driveLetter, driveLetterLogFile]);

    // Default drive letters logic to set for quick and advanced view
    useEffect(() => {
        dispatch(setDriveLetter(null));
        dispatch(setDriveLetterForLogFile(null));
        if (selectedNewUserConfig === GENERAL.DB_QUICK_CREATE) {
            // For quick - Select drive letters from available drives list
            const avlDrive = driveInfoList?.availableDriveLetters;
            if (avlDrive && avlDrive.length >= 2) {
                const option1 = generateOptionType(avlDrive[0], avlDrive[0], DRIVE_LETTER_TYPE.NEW, false, '');
                dispatch(setDriveLetter(option1));
                const option2 = generateOptionType(avlDrive[1], avlDrive[1], DRIVE_LETTER_TYPE.NEW, false, '');
                dispatch(setDriveLetterForLogFile(option2));
            }
        } else if (selectedNewUserConfig === GENERAL.DB_ADVANCED_CREATE) {
            // For Advanced - Select default drive letters
            const defaultDataDrive = driveInfoList?.defaultDataDrive;
            const defaultLogDrive = driveInfoList?.defaultLogDrive;
            driveInfoList?.existingDriveInfo?.map((val: any, idx: number) => {
                const option = generateOptionType(
                    val?.driveLetter,
                    val?.driveLetter,
                    DRIVE_LETTER_TYPE.EXISTING,
                    !val?.isNetappDrive || ('isDriveClustered' in val ? !val.isDriveClustered : false),
                    disableDriveMsg(val),
                    val
                );
                if (defaultDataDrive === val?.driveLetter && !option.isDisabled) {
                    dispatch(setDriveLetter(option));
                }
                if (defaultLogDrive === val?.driveLetter && !option.isDisabled) {
                    dispatch(setDriveLetterForLogFile(option));
                }
            });
        }
    }, [selectedNewUserConfig, driveInfoList, isDataVirtualMountPoint, isLogVirtualMountPoint]);

    // Based of selected drive letters need to add if it is a existing or new drive letters
    useEffect(() => {
        dispatch(setIsExistingDataDrive(driveLetter?.label2 === DRIVE_LETTER_TYPE.EXISTING));
        dispatch(setIsExistingLogDrive(driveLetterLogFile?.label2 === DRIVE_LETTER_TYPE.EXISTING));
    }, [driveLetter, driveLetterLogFile]);

    //Set the Header text here
    const setHeader = () => {
        // For quick create it will just show file name. For advanced it will show path also.
        if (isValidDataName() && isValidLogName()) {
            return <AccordionError />;
        } else if (
            newUserDBFileName &&
            newUserLogFileName &&
            (selectedNewUserConfig === GENERAL.DB_ADVANCED_CREATE ? driveLetter && driveLetterLogFile : true)
        ) {
            return (
                <DsTypography variant="Regular_14" className={CommonStyles.setHeaderStyle}>
                    <div className={styles.headerText}>
                        <DsTypography variant="Regular_14" className={styles.headerWrap} title={newUserDBFileName}>
                            {`${GENERAL.DATA_FILE_NAME}: ${newUserDBFileName}`}{' '}
                        </DsTypography>
                        {dataFilePath && (
                            <TooltipInfo onVisibleChange={function noRefCheck() {}}>{dataFilePath}</TooltipInfo>
                        )}
                    </div>

                    <div className={CommonStyles.separator} />

                    <div className={styles.headerText}>
                        <DsTypography variant="Regular_14" className={styles.headerWrap} title={newUserLogFileName}>
                            {`${GENERAL.LOG_FILE_NAME}: ${newUserLogFileName}`}{' '}
                        </DsTypography>
                        {logFilePath && (
                            <TooltipInfo onVisibleChange={function noRefCheck() {}}>{logFilePath}</TooltipInfo>
                        )}
                    </div>
                </DsTypography>
            );
        }
        return <ActionRequired error={!dbCreateDataNameAdded || !dbCreateLogNameAdded ? true : false} />;
    };

    function isValidDataName() {
        if (isDemoMode) {
            return '';
        }
        if (!dbCreateDataNameAdded && (!newUserDBFileName || newUserDBFileName.length === 0)) {
            return GENERAL.ACTION_REQUIRED;
        }
        return isValidFileName(newUserDBFileName) ? '' : GENERAL.DB_DATA_NAME_ERROR_CHECK;
    }

    function isValidLogName() {
        if (isDemoMode) {
            return '';
        }
        if (!dbCreateLogNameAdded && (!newUserLogFileName || newUserLogFileName.length === 0)) {
            return GENERAL.ACTION_REQUIRED;
        }
        return isValidFileName(newUserLogFileName) ? '' : GENERAL.DB_LOG_NAME_ERROR_CHECK;
    }

    return (
        <div className={styles.fileNames}>
            <AccordionCard
                isLoading={driveInfoListLoading}
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="3"
                title={<div className={CommonStyles.title}>{GENERAL.DB_CREATE_FILE_NAMES_AND_PATH}</div>}
            >
                <AccordionCardContent>
                    <DsTypography>
                        {selectedNewUserConfig === GENERAL.DB_ADVANCED_CREATE && (
                            <div className={styles.textSection}>
                                <div className={styles.firstSection}>
                                    <DsTypography variant="Regular_14">{GENERAL.FILE_SETTINGS_FIRST_TEXT}</DsTypography>
                                </div>
                                <div className={styles.firstSection}>
                                    <DsTypography variant="Regular_14">
                                        {GENERAL.FILE_SETTINGS_SECOND_TEXT}
                                    </DsTypography>
                                </div>
                            </div>
                        )}
                        <div className={styles.dataFileSection}>
                            <DsTypography variant="Regular_14">{GENERAL.DATA_FILE}</DsTypography>
                            <div className={styles.dataFileSeparator} />
                            <div className={styles.inputSection}>
                                {selectedNewUserConfig === GENERAL.DB_ADVANCED_CREATE && (
                                    <SelectField
                                        isLoading={driveInfoListLoading}
                                        label={GENERAL.SELECT_DRIVE_LETTER}
                                        isClearable={false}
                                        placeholder={GENERAL.SELECT_DRIVE_LETTER}
                                        onChange={(selectedOptions: any): void => {
                                            dispatch(setDriveLetter(selectedOptions));
                                        }}
                                        value={driveLetter ? driveLetter : null}
                                        isSearchable={generateDataDriveLetters.length > 5}
                                        options={generateDataDriveLetters}
                                        variant="two-lines"
                                        className={styles.driveSelectField}
                                    />
                                )}

                                <div className={styles.firstRow}>
                                    <TextField
                                        ref={dataNameRef}
                                        label={GENERAL.DATA_FILE_NAME}
                                        placeholder={GENERAL.DATA_FILE_NAME}
                                        value={newUserDBFileName}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            // This flag is to validate if user has changed data file name by itself
                                            if (e.target.value) {
                                                setDataFileNameChange(true);
                                            } else {
                                                setDataFileNameChange(false);
                                            }
                                            dispatch(setNewDBFileName(e.target.value));
                                        }}
                                        className={styles.advFileNameText}
                                        error={useDelayedError(isValidDataName())}
                                        info={
                                            <div className={styles.nameTooltip}>
                                                <div className={styles.listItem}>
                                                    <Bullet />
                                                    <DsTypography variant="Regular_13" className={styles.textWidth}>
                                                        {GENERAL.CREATE_DB_DATA_FILE_NAME_TOOLTIP[0]}
                                                    </DsTypography>
                                                </div>
                                                <div className={styles.listItem}>
                                                    <Bullet />
                                                    <DsTypography variant="Regular_13" className={styles.textWidth}>
                                                        {GENERAL.CREATE_DB_DATA_FILE_NAME_TOOLTIP[1]}
                                                    </DsTypography>
                                                </div>
                                            </div>
                                        }
                                    />
                                </div>
                                <div className={styles.pathSection}>
                                    <DsTypography variant="Semibold_14">{GENERAL.DATA_FILE_PATH} </DsTypography>
                                    &nbsp;&nbsp;
                                    <DsTypography variant="Regular_14" className={styles.pathText} title={dataFilePath}>
                                        {dataFilePath}
                                    </DsTypography>
                                </div>
                            </div>
                            {selectedNewUserConfig === GENERAL.DB_QUICK_CREATE && (
                                <div className={styles.virtualMountPoint}>
                                    <DsCheckbox
                                        id="data-virtual-mount-point"
                                        title="Virtual mount point"
                                        onSelect={() => {
                                            dispatch(setIsDataVirtualMountPoint(!isDataVirtualMountPoint));
                                        }}
                                        isSelected={isDataVirtualMountPoint}
                                        isDisabled={isVirtualMountPointDisabled}
                                    />
                                </div>
                            )}
                        </div>

                        <div className={styles.dataFileSection}>
                            <DsTypography variant="Regular_14">{GENERAL.LOG_FILE}</DsTypography>
                            <div className={styles.dataFileSeparator} />
                            <div className={styles.inputSection}>
                                {selectedNewUserConfig === GENERAL.DB_ADVANCED_CREATE && (
                                    <SelectField
                                        isLoading={driveInfoListLoading}
                                        label={GENERAL.SELECT_DRIVE_LETTER}
                                        isClearable={false}
                                        placeholder={GENERAL.SELECT_DRIVE_LETTER}
                                        onChange={(selectedOptions: any): void => {
                                            dispatch(setDriveLetterForLogFile(selectedOptions));
                                        }}
                                        value={driveLetterLogFile ? driveLetterLogFile : null}
                                        isSearchable={generateLogDriveLetters.length > 5}
                                        options={generateLogDriveLetters}
                                        variant="two-lines"
                                        className={styles.driveSelectField}
                                    />
                                )}

                                <div className={styles.firstRow}>
                                    <TextField
                                        ref={logNameRef}
                                        label={GENERAL.LOG_FILE_NAME}
                                        placeholder={GENERAL.LOG_FILE_NAME}
                                        value={newUserLogFileName}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            // This flag is to validate if user has changed log file name by itself
                                            if (e.target.value) {
                                                setLogFileNameChange(true);
                                            } else {
                                                setLogFileNameChange(false);
                                            }
                                            dispatch(setNewUserLogFileName(e.target.value));
                                        }}
                                        className={styles.advFileNameText}
                                        error={useDelayedError(isValidLogName())}
                                        info={
                                            <div className={styles.nameTooltip}>
                                                <div className={styles.listItem}>
                                                    <Bullet />
                                                    <DsTypography variant="Regular_13" className={styles.textWidth}>
                                                        {GENERAL.CREATE_DB_LOG_FILE_NAME_TOOLTIP[0]}
                                                    </DsTypography>
                                                </div>
                                                <div className={styles.listItem}>
                                                    <Bullet />
                                                    <DsTypography variant="Regular_13" className={styles.textWidth}>
                                                        {GENERAL.CREATE_DB_LOG_FILE_NAME_TOOLTIP[1]}
                                                    </DsTypography>
                                                </div>
                                            </div>
                                        }
                                    />
                                </div>
                                <div className={styles.pathSection}>
                                    <DsTypography variant="Semibold_14">{GENERAL.LOG_FILE_PATH}</DsTypography>
                                    &nbsp;&nbsp;
                                    <DsTypography variant="Regular_14" className={styles.pathText} title={logFilePath}>
                                        {logFilePath}
                                    </DsTypography>
                                </div>
                            </div>
                            {GENERAL.DB_QUICK_CREATE && (
                                <div className={styles.virtualMountPoint}>
                                    <DsCheckbox
                                        id="log-virtual-mount-point"
                                        title="Virtual mount point"
                                        onSelect={() => {
                                            dispatch(setIsLogVirtualMountPoint(!isLogVirtualMountPoint));
                                        }}
                                        isSelected={isLogVirtualMountPoint}
                                        isDisabled={isVirtualMountPointDisabled}
                                    />
                                </div>
                            )}
                        </div>
                    </DsTypography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default FileNames;
