import { AccordionCard, AccordionCardContent, DsTypography, TextField, TooltipInfo } from '@netapp/design-system';
import ActionRequired from '../../../../../common/ActionRequired/ActionRequired';

import { useAppSelector } from '../../../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import {
    setNewDBFileName,
    setNewUserLogFileName,
    setDriveLetter,
    setDriveLetterForLogFile
} from '../../../../../store/workloadFactory/createNewDBSlice';
import { useEffect, useMemo, useState } from 'react';
import { SelectField, optionType } from '@netapp/design-system/dist/components/Select';
import { generateOptionType } from '../../../../../utils/utilityFunctions';

import styles from './FileNames.module.scss';
import CommonStyles from '../../../../../utils/CommonStyles.module.scss';
import { GENERAL } from '../../../../../utils/appConstants';
import { useGetDriveInfoQuery } from '../../../../../utils/apiService';
import { DRIVE_LETTER_TYPE } from '../../../../../utils/consts';

const FileNames = () => {
    const dispatch = useDispatch();

    const {
        newUserDBFileName,
        newUserLogFileName,
        selectedNewUserConfig,
        driveLetter,
        driveLetterLogFile,
        newUserDBName
    } = useAppSelector(state => state.createNewUser);

    const [dataFilePath, setDataFilePath] = useState('');
    const [logFilePath, setLogFilePath] = useState('');
    const resourceId = useAppSelector(state => state.auth.resourceId);

    const { data: driveInfoList, isFetching: driveInfoListLoading } = useGetDriveInfoQuery({ id: resourceId });

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
    const generateDriveLetters = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        driveInfoList?.existingDriveInfo?.map((val: any, idx: number) => {
            const option = generateOptionType(
                val?.driveLetter,
                val?.driveLetter,
                DRIVE_LETTER_TYPE.EXISTING,
                !val?.isNetappDrive,
                ''
            );
            if (val?.defaultDataDrive) {
                dispatch(setDriveLetter(option));
            }
            if (val?.defaultLogDrive) {
                dispatch(setDriveLetterForLogFile(option));
            }
            options.push(option);
        });
        driveInfoList?.availableDriveLetters?.map((val: any, idx: number) => {
            const option = generateOptionType(val, val, DRIVE_LETTER_TYPE.NEW, false, '');
            options.push(option);
        });
        return options;
    }, [driveInfoList]);

    //Set the Header text here
    const setHeader = () => {
        if (newUserDBFileName && newUserLogFileName) {
            return (
                <DsTypography variant="Regular_14" className={CommonStyles.setHeaderStyle}>
                    <div className={styles.headerText}>
                        <DsTypography variant="Regular_14">
                            {`${GENERAL.DATA_FILE_NAME}: ${newUserDBFileName}`}{' '}
                        </DsTypography>
                        {selectedNewUserConfig === GENERAL.DB_ADVANCED_CREATE && dataFilePath && (
                            <TooltipInfo onVisibleChange={function noRefCheck() {}}>{dataFilePath}</TooltipInfo>
                        )}
                    </div>

                    <div className={CommonStyles.separator} />

                    <div className={styles.headerText}>
                        <DsTypography variant="Regular_14">
                            {`${GENERAL.LOG_FILE_NAME}: ${newUserLogFileName}`}{' '}
                        </DsTypography>
                        {selectedNewUserConfig === GENERAL.DB_ADVANCED_CREATE && logFilePath && (
                            <TooltipInfo onVisibleChange={function noRefCheck() {}}>{logFilePath}</TooltipInfo>
                        )}
                    </div>
                </DsTypography>
            );
        }
        return <ActionRequired error={false} />;
    };

    return (
        <div className={styles.fileNames}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="3"
                title={
                    <div className={CommonStyles.title}>
                        {selectedNewUserConfig === GENERAL.DB_QUICK_CREATE
                            ? GENERAL.DB_CREATE_FILE_NAMES
                            : GENERAL.DB_CREATE_FILE_NAMES_AND_DRIVES}
                    </div>
                }
            >
                <AccordionCardContent>
                    <DsTypography>
                        {selectedNewUserConfig === GENERAL.DB_QUICK_CREATE && (
                            <>
                                <div className={styles.firstRow}>
                                    <TextField
                                        label={GENERAL.DATA_FILE_NAME}
                                        placeholder={GENERAL.DATA_FILE_NAME}
                                        value={newUserDBFileName}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            dispatch(setNewDBFileName(e.target.value));
                                        }}
                                        className={styles.quickFileNameText}
                                    />
                                    <TextField
                                        label={GENERAL.LOG_FILE_NAME}
                                        placeholder={GENERAL.LOG_FILE_NAME}
                                        value={newUserLogFileName}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            dispatch(setNewUserLogFileName(e.target.value));
                                        }}
                                        className={styles.quickFileNameText}
                                    />
                                </div>
                            </>
                        )}

                        {/* Advanced Create Logic */}
                        {selectedNewUserConfig === GENERAL.DB_ADVANCED_CREATE && (
                            <>
                                <div className={styles.textSection}>
                                    <div className={styles.firstSection}>
                                        <DsTypography variant="Regular_14">
                                            {GENERAL.FILE_SETTINGS_FIRST_TEXT}
                                        </DsTypography>
                                    </div>
                                    <div className={styles.firstSection}>
                                        <DsTypography variant="Regular_14">
                                            {GENERAL.FILE_SETTINGS_SECOND_TEXT}
                                        </DsTypography>
                                    </div>
                                </div>
                                <div className={styles.dataFileSection}>
                                    <DsTypography variant="Regular_14">{GENERAL.DATA_FILE}</DsTypography>
                                    <div className={styles.dataFileSeparator} />
                                    <div className={styles.inputSection}>
                                        <SelectField
                                            isLoading={driveInfoListLoading}
                                            label="Select drive letter"
                                            isClearable={false}
                                            placeholder="Select drive letter"
                                            onChange={(selectedOptions: any): void => {
                                                dispatch(setDriveLetter(selectedOptions));
                                            }}
                                            value={driveLetter ? driveLetter : null}
                                            isSearchable={generateDriveLetters.length > 5}
                                            options={generateDriveLetters}
                                            variant="two-lines"
                                            className={styles.driveSelectField}
                                        />

                                        <div className={styles.firstRow}>
                                            <TextField
                                                label={GENERAL.DATA_FILE_NAME}
                                                placeholder={GENERAL.DATA_FILE_NAME}
                                                value={newUserDBFileName}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                    dispatch(setNewDBFileName(e.target.value));
                                                }}
                                                className={styles.advFileNameText}
                                            />
                                        </div>
                                        <div className={styles.pathSection}>
                                            <DsTypography variant="Semibold_14">{GENERAL.DATA_FILE_PATH} </DsTypography>
                                            &nbsp;&nbsp;
                                            <DsTypography variant="Regular_14">{dataFilePath}</DsTypography>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.dataFileSection}>
                                    <DsTypography variant="Regular_14">{GENERAL.LOG_FILE}</DsTypography>
                                    <div className={styles.dataFileSeparator} />
                                    <div className={styles.inputSection}>
                                        <SelectField
                                            isLoading={driveInfoListLoading}
                                            label="Select drive letter"
                                            isClearable={false}
                                            placeholder="Select drive letter"
                                            onChange={(selectedOptions: any): void => {
                                                dispatch(setDriveLetterForLogFile(selectedOptions));
                                            }}
                                            value={driveLetterLogFile ? driveLetterLogFile : null}
                                            isSearchable={generateDriveLetters.length > 5}
                                            options={generateDriveLetters}
                                            variant="two-lines"
                                            className={styles.driveSelectField}
                                        />

                                        <div className={styles.firstRow}>
                                            <TextField
                                                label={GENERAL.LOG_FILE_NAME}
                                                placeholder={GENERAL.LOG_FILE_NAME}
                                                value={newUserLogFileName}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                    dispatch(setNewUserLogFileName(e.target.value));
                                                }}
                                                className={styles.advFileNameText}
                                            />
                                        </div>
                                        <div className={styles.pathSection}>
                                            <DsTypography variant="Semibold_14">{GENERAL.LOG_FILE_PATH}</DsTypography>
                                            &nbsp;&nbsp;
                                            <DsTypography variant="Regular_14">{logFilePath}</DsTypography>
                                        </div>
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

export default FileNames;
