import { AccordionCard, AccordionCardContent, DsRadioButton, DsTypography, TextField } from '@netapp/design-system';
import styles from './Mount.module.scss';
import CommonStyles from '../../../../../utils/CommonStyles.module.scss';
import { useAppSelector } from '../../../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import {
    setDataDriveMountPoint,
    setLogDriveMountPoint,
    setSelectedMount
} from '../../../../../store/workloadFactory/createSandboxSlice';
import { GENERAL } from '../../../../../utils/appConstants';
import ActionRequired from '../../../../../common/ActionRequired/ActionRequired';
import { useEffect, useMemo, useState } from 'react';
import { SelectField, optionType } from '@netapp/design-system/dist/components/Select';
import { generateOptionType, sortListOfDict } from '../../../../../utils/utilityFunctions';
import { getDefaultDriveLetters } from '../../../SandboxUtility';

const Mount = () => {
    const { selectedMount, dataDriveMountPoint, logDriveMountPoint, getDbMountPoints, getDriveInfo, source, target } =
        useAppSelector(state => state.createSandbox);
    const { dbMountPointsData, dbMountPointsLoading } = getDbMountPoints;
    const { driveInfoData, driveInfoLoading } = getDriveInfo;
    const [dataFilePathSuffix, setDataFilePathSuffix] = useState('');
    const [logFilePathSuffix, setLogFilePathSuffix] = useState('');
    const [dataFilePath, setDataFilePath] = useState('');
    const [logFilePath, setLogFilePath] = useState('');
    const dispatch = useDispatch();
    const setHeader = () => {
        if (selectedMount === GENERAL.AUTO_ASSIGN_MOUNT_POINT) {
            return <DsTypography variant="Regular_14">{GENERAL.AUTO_ASSIGN_MOUNT_POINT}</DsTypography>;
        } else if (selectedMount === GENERAL.DEFINE_MOUNT_POINT_PATH && (!dataDriveMountPoint || !logDriveMountPoint)) {
            return (
                <div className={styles.actionRequired}>
                    <ActionRequired />
                </div>
            );
        }
        return (
            <DsTypography variant="Regular_14" className={CommonStyles.setHeaderStyleSandbox} title={''}>
                {GENERAL.VOLUME_MOUNT_POINT_UNDER_PATH} : {''}
            </DsTypography>
        );
    };

    //useEffect to extract path based on response of database-mount-point API, driveInfo API and based on mount type
    useEffect(() => {
        const { dataDrive, logDrive } = getDefaultDriveLetters(
            dbMountPointsData,
            source,
            target,
            selectedMount,
            driveInfoData
        );
        dispatch(setDataDriveMountPoint(dataDrive));
        dispatch(setLogDriveMountPoint(logDrive));
    }, [selectedMount, dbMountPointsData, driveInfoData, source, target]);

    //useEffect to extract path based on response of database-mount-point API
    useEffect(() => {
        const { databaseDataPath, databaseLogPath } = dbMountPointsData || {};
        const dataPathSuffix = databaseDataPath?.[0]?.split('\\')?.slice(1)?.join('\\');
        const logPathSuffix = databaseLogPath?.[0]?.split('\\')?.slice(1)?.join('\\');
        setDataFilePathSuffix(dataPathSuffix);
        setLogFilePathSuffix(logPathSuffix);
    }, [dbMountPointsData]);

    //useEffect to generate data file path and log file path
    useEffect(() => {
        const truncatedDbName = target?.selectedDatabase
            ? target.selectedDatabase.substring(0, Math.min(target.selectedDatabase.length, 25))
            : '';
        setDataFilePath(`${dataDriveMountPoint}:\\${truncatedDbName}-Data\\${dataFilePathSuffix}`);
        setLogFilePath(`${logDriveMountPoint}:\\${truncatedDbName}-Log\\${logFilePathSuffix}`);
    }, [dataFilePathSuffix, logFilePathSuffix, dataDriveMountPoint, logDriveMountPoint, target]);

    const disableDriveMsg = (val: any) => {
        if (!val?.isNetappDrive) {
            return GENERAL.NON_NETAPP_DRIVE;
        } else if ('isDriveClustered' in val ? !val.isDriveClustered : false) {
            return GENERAL.NON_CLUSTERED_DRIVE;
        }
        return '';
    };

    const generateDataDriveLetters = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        driveInfoData?.existingDriveInfo?.map((val: any, idx: number) => {
            const option = generateOptionType(
                val?.driveLetter,
                val?.driveLetter,
                '',
                !val?.isNetappDrive || ('isDriveClustered' in val ? !val.isDriveClustered : false),
                disableDriveMsg(val),
                val
            );
            options.push(option);
        });
        return sortListOfDict(options, 'isDisabled');
    }, [driveInfoData]);

    const generateLogDriveLetters = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        driveInfoData?.existingDriveInfo?.map((val: any, idx: number) => {
            const option = generateOptionType(
                val?.driveLetter,
                val?.driveLetter,
                '',
                !val?.isNetappDrive || ('isDriveClustered' in val ? !val.isDriveClustered : false),
                disableDriveMsg(val),
                val
            );
            options.push(option);
        });
        return sortListOfDict(options, 'isDisabled');
    }, [driveInfoData]);

    const handleRadio = (val: string) => {
        dispatch(setSelectedMount(val));
    };
    return (
        <div className={styles.Mount}>
            <AccordionCard
                ValueContent={() => (
                    <div className={`${CommonStyles['heading-content']} ${styles.headerSetter}`}>{setHeader()}</div>
                )}
                id="3"
                title={<div className={CommonStyles.title}>{'Mount'}</div>}
                isLoading={dbMountPointsLoading || driveInfoLoading}
                isExpandDisabled={dbMountPointsLoading || driveInfoLoading}
            >
                <AccordionCardContent>
                    <DsTypography>
                        <div className={styles.radios}>
                            <DsRadioButton
                                isSelected={selectedMount === GENERAL.AUTO_ASSIGN_MOUNT_POINT}
                                title={GENERAL.AUTO_ASSIGN_MOUNT_POINT}
                                id="1"
                                variant="Default"
                                onClick={() => handleRadio(GENERAL.AUTO_ASSIGN_MOUNT_POINT)}
                            />

                            <DsRadioButton
                                isSelected={selectedMount === GENERAL.DEFINE_MOUNT_POINT_PATH}
                                title={GENERAL.DEFINE_MOUNT_POINT_PATH}
                                id="2"
                                variant="Default"
                                onClick={() => handleRadio(GENERAL.DEFINE_MOUNT_POINT_PATH)}
                            />
                        </div>
                        {selectedMount === GENERAL.AUTO_ASSIGN_MOUNT_POINT && (
                            <div className={styles.autoAssignContent}>
                                {' '}
                                <div className={styles.pathSection}>
                                    <DsTypography variant="Semibold_14">{GENERAL.DATA_FILE_PATH} </DsTypography>
                                    &nbsp;&nbsp;
                                    <DsTypography variant="Regular_14" className={styles.pathText} title={dataFilePath}>
                                        {dataFilePath}
                                    </DsTypography>
                                </div>
                                <div className={styles.pathSection}>
                                    <DsTypography variant="Semibold_14">{GENERAL.LOG_FILE_PATH} </DsTypography>
                                    &nbsp;&nbsp;
                                    <DsTypography variant="Regular_14" className={styles.pathText} title={logFilePath}>
                                        {logFilePath}
                                    </DsTypography>
                                </div>
                            </div>
                        )}
                        {selectedMount === GENERAL.DEFINE_MOUNT_POINT_PATH && (
                            <div className={styles.defineMountPointContent}>
                                <div className={styles.defineMountPointRow}>
                                    <SelectField
                                        isLoading={false}
                                        label={GENERAL.SELECT_DATA_DRIVE_LETTER}
                                        isClearable={false}
                                        placeholder={GENERAL.SELECT_DRIVE_LETTER}
                                        onChange={(selectedOptions: any): void => {
                                            console.log(selectedOptions);
                                            dispatch(setDataDriveMountPoint(selectedOptions?.value));
                                        }}
                                        value={
                                            dataDriveMountPoint
                                                ? generateOptionType(
                                                      dataDriveMountPoint,
                                                      dataDriveMountPoint,
                                                      '',
                                                      false,
                                                      ''
                                                  )
                                                : undefined
                                        }
                                        isSearchable={generateDataDriveLetters.length > 5}
                                        options={generateDataDriveLetters}
                                        variant="two-lines"
                                        className={styles.driveSelectField}
                                    />
                                    <div className={styles.pathSection}>
                                        <DsTypography variant="Semibold_14">{GENERAL.DATA_FILE_PATH} </DsTypography>
                                        &nbsp;&nbsp;
                                        <DsTypography
                                            variant="Regular_14"
                                            className={styles.pathText}
                                            title={dataFilePath}
                                        >
                                            {dataFilePath}
                                        </DsTypography>
                                    </div>
                                </div>
                                <div className={styles.defineMountPointRow}>
                                    <SelectField
                                        isLoading={false}
                                        label={GENERAL.SELECT_LOG_DRIVE_LETTER}
                                        isClearable={false}
                                        placeholder={GENERAL.SELECT_DRIVE_LETTER}
                                        onChange={(selectedOptions: any): void => {
                                            dispatch(setLogDriveMountPoint(selectedOptions?.value));
                                        }}
                                        value={
                                            logDriveMountPoint
                                                ? generateOptionType(
                                                      logDriveMountPoint,
                                                      logDriveMountPoint,
                                                      '',
                                                      false,
                                                      ''
                                                  )
                                                : undefined
                                        }
                                        isSearchable={generateLogDriveLetters.length > 5}
                                        options={generateLogDriveLetters}
                                        variant="two-lines"
                                        className={styles.driveSelectField}
                                    />
                                    <div className={styles.pathSection}>
                                        <DsTypography variant="Semibold_14">{GENERAL.LOG_FILE_PATH} </DsTypography>
                                        &nbsp;&nbsp;
                                        <DsTypography
                                            variant="Regular_14"
                                            className={styles.pathText}
                                            title={logFilePath}
                                        >
                                            {logFilePath}
                                        </DsTypography>
                                    </div>
                                </div>
                            </div>
                        )}
                    </DsTypography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default Mount;
