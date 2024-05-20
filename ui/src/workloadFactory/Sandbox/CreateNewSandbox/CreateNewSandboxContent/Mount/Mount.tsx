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
import { useEffect, useState } from 'react';

const Mount = () => {
    const { selectedMount, dataDriveMountPoint, logDriveMountPoint, getDbMountPoints, getDriveInfo, source, target } =
        useAppSelector(state => state.createSandbox);
    const { dbMountPointsData, dbMountPointsLoading } = getDbMountPoints;
    const { driveInfoData, driveInfoLoading } = getDriveInfo;
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

    useEffect(() => {
        const { databaseDataPath, databaseLogPath } = dbMountPointsData || {};
        const dataPathSplitArr = databaseDataPath?.[0] ? databaseDataPath[0].split('\\') : [];
        const logPathSplitArr = databaseLogPath?.[0] ? databaseLogPath[0].split('\\') : [];
        const dataPathDrive = dataPathSplitArr?.[0]?.[0];
        const logPathDrive = logPathSplitArr?.[0]?.[0];
        const dataPathSuffix = dataPathSplitArr.length ? dataPathSplitArr.slice(1).join('\\') : '';
        const logPathSuffix = logPathSplitArr.length ? logPathSplitArr.slice(1).join('\\') : '';
        const truncatedDbName = target?.selectedDatabase
            ? target.selectedDatabase.substring(0, Math.min(target.selectedDatabase.length, 25))
            : '';
        if (selectedMount === GENERAL.AUTO_ASSIGN_MOUNT_POINT) {
            if (
                source?.selectedDatabaseHost?.value === target?.selectedDatabaseHost?.value &&
                source?.selectedDatabaseInstance?.value === target?.selectedDatabaseInstance?.value
            ) {
                setDataFilePath(`${dataPathDrive}:\\${truncatedDbName}-Data\\${dataPathSuffix}`);
                setLogFilePath(`${logPathDrive}:\\${truncatedDbName}-Log\\${logPathSuffix}`);
                dispatch(setDataDriveMountPoint(dataPathDrive));
                dispatch(setLogDriveMountPoint(logPathDrive));
            } else {
                let dataDrive: any;
                let logDrive: any;
                const recommendedDataDrive = driveInfoData?.existingDriveInfo?.find(
                    (drive: any) => drive.driveLetter === dataPathDrive
                );
                const recommendedLogDrive = driveInfoData?.existingDriveInfo?.find(
                    (drive: any) => drive.driveLetter === logPathDrive
                );
                if (recommendedDataDrive?.isDriveClustered && recommendedDataDrive?.isNetappDrive) {
                    setDataFilePath(`${dataPathDrive}:\\${truncatedDbName}-Data\\${dataPathSuffix}`);
                    dataDrive = dataPathDrive;
                } else {
                    const validDrive = driveInfoData?.existingDriveInfo?.find(
                        (drive: any) => drive.driveLetter === dataPathDrive
                    );
                    dataDrive = validDrive;
                }
                if (recommendedLogDrive?.isDriveClustered && recommendedLogDrive?.isNetappDrive) {
                    setLogFilePath(`${logPathDrive}:\\${truncatedDbName}-Data\\${dataPathSuffix}`);
                    logDrive = logPathDrive;
                } else {
                    const validDrive = driveInfoData?.existingDriveInfo?.find(
                        (drive: any) => drive.driveLetter === dataPathDrive && drive.driveLetter !== dataDrive
                    );
                    logDrive = validDrive;
                }
                dispatch(setDataDriveMountPoint(dataDrive));
                dispatch(setLogDriveMountPoint(logDrive));
            }
        }
    }, [selectedMount, dbMountPointsData, driveInfoData, source, target]);

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
                                isDisabled={true}
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
                                {' '}
                                <div className={styles.pathSection}>
                                    <DsTypography variant="Semibold_14">{GENERAL.DATA_FILE_PATH} </DsTypography>
                                    &nbsp;&nbsp;
                                    <DsTypography variant="Regular_14" className={styles.pathText} title={''}>
                                        {''}
                                    </DsTypography>
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
