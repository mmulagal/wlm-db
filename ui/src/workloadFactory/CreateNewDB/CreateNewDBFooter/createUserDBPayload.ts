import {
    setDbCreateDataNameAdded,
    setDbCreateDataSizeValid,
    setDbCreateHit,
    setDbCreateLogNameAdded,
    setDbCreateLogSizeValid,
    setDbCreateNameAdded,
    setDbCreatePressed
} from '../../../store/mssql/msSqlActionSlice';
import { NOTIFICATION_TYPES, addNotification } from '../../../store/notificationSlice';
import { GENERAL } from '../../../utils/appConstants';

export const createUserDbPayload = (newUserDb: any) => {
    let payload = {
        databaseName: newUserDb?.newUserDBName,
        dataFileConfig: {
            fileName: newUserDb?.newUserDBFileName ? newUserDb.newUserDBFileName + '.mdf' : '',
            volumeSize:
                newUserDb?.newUserDataSizeUnit === 'TiB'
                    ? newUserDb?.newUserDataSize * 1024
                    : newUserDb?.newUserDataSize,
            drive: newUserDb?.driveLetter?.value || '',
            isExisting: newUserDb?.isExistingDataDrive
        },
        logFileConfig: {
            fileName: newUserDb?.newUserLogFileName ? newUserDb.newUserLogFileName + '.ldf' : '',
            volumeSize:
                newUserDb?.newUserLogFileSizeUnit === 'TiB'
                    ? newUserDb?.newUserLogFileSize * 1024
                    : newUserDb?.newUserLogFileSize,
            drive: newUserDb?.driveLetterLogFile?.value || '',
            isExisting: newUserDb?.isExistingLogDrive
        },
        collation: newUserDb?.selectedCollation?.label || ''
    };
    return payload;
};

export const isValidDatabaseName = (name: any) => {
    if (name && name.length > 0 && (name.length > 123 || !/^[a-zA-Z0-9/_]+$/.test(name))) {
        return false;
    }
    return true;
};

export const isValidFileName = (name: any) => {
    if (name && name.length > 0 && (name.length > 128 || !/^[a-zA-Z0-9/_]+$/.test(name))) {
        return false;
    }
    return true;
};

export const handleCreateUserDb = (state: any, dispatch: any) => {
    let payload;
    dispatch(setDbCreatePressed(true));
    dispatch(setDbCreateHit(Math.random()));
    if (state.auth.isDemoMode) {
        // For demo mode no need to have validations
        payload = createUserDbPayload(state?.createNewUser);
    } else {
        // Fields validation checks
        const dbNameStateValue =
            !state?.createNewUser?.newUserDBName || !isValidDatabaseName(state?.createNewUser?.newUserDBName);
        const dbDataNameStateValue =
            !state?.createNewUser?.newUserDBFileName || !isValidFileName(state?.createNewUser?.newUserDBFileName);
        const dbLogNameStateValue =
            !state?.createNewUser?.newUserLogFileName || !isValidFileName(state?.createNewUser?.newUserLogFileName);
        const dbDataSizeState = !state?.createNewUser?.newUserDataSize || !state?.createNewUser?.isDataSizeValid;
        const dbLogSizeState = !state?.createNewUser?.newUserLogFileSize || !state?.createNewUser?.isLogSizeValid;
        const driveLettersState =
            !state?.createNewUser?.driveLetter?.value || !state?.createNewUser?.driveLetterLogFile?.value;
        const newDriveLettersState = () => {
            if (state?.createNewUser?.selectedNewUserConfig === GENERAL.DB_QUICK_CREATE) {
                if (!state?.createNewUser?.driveInfoListLoading && state?.createNewUser?.driveInfoList) {
                    const avlDrive = state.createNewUser.driveInfoList?.availableDriveLetters;
                    if (!avlDrive || avlDrive.length < 2) {
                        return true;
                    }
                }
            }
            return false;
        };
        const collation = state?.createNewUser?.selectedCollation?.label;

        //Check for Create DB username value
        if (dbNameStateValue) {
            dispatch(setDbCreateNameAdded(false));
        } else {
            dispatch(setDbCreateNameAdded(true));
        }
        //Check for Create DB data file name value
        if (dbDataNameStateValue) {
            dispatch(setDbCreateDataNameAdded(false));
        } else {
            dispatch(setDbCreateDataNameAdded(true));
        }
        //Check for Create DB log file name value
        if (dbLogNameStateValue) {
            dispatch(setDbCreateLogNameAdded(false));
        } else {
            dispatch(setDbCreateLogNameAdded(true));
        }
        //Check for Create DB data size value
        if (dbDataSizeState) {
            dispatch(setDbCreateDataSizeValid(false));
        } else {
            dispatch(setDbCreateDataSizeValid(true));
        }
        //Check for Create DB log size value
        if (dbLogSizeState) {
            dispatch(setDbCreateLogSizeValid(false));
        } else {
            dispatch(setDbCreateLogSizeValid(true));
        }

        // If any of below fields check are true it means data is not valid. It will open respective accordion with action required error.
        if (!dbNameStateValue && !dbDataNameStateValue && !dbLogNameStateValue && !dbDataSizeState && !dbLogSizeState) {
            if (newDriveLettersState()) {
                // In case of quick create if new drive letters list has less than 2 drives than it will not proceed for DB creation.
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.ERROR,
                        message: GENERAL.DRIVE_LETTER_QUICK_CREATE_ERROR
                    })
                );
            } else if (driveLettersState) {
                // If data and log drive letters are not selected than it will throw below error
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.ERROR,
                        message: GENERAL.DRIVE_LETTER_CREATE_ERROR
                    })
                );
            } else if (!collation) {
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.ERROR,
                        message: GENERAL.COLLATION_ERROR
                    })
                );
            } else {
                payload = createUserDbPayload(state?.createNewUser);
            }
        }
    }
    return payload;
};
