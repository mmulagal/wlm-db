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
            fileName: newUserDb?.newUserDBFileName,
            volumeSize:
                newUserDb?.newUserDataSizeUnit === 'TiB'
                    ? newUserDb?.newUserDataSize * 1024
                    : newUserDb?.newUserDataSize,
            drive: newUserDb?.driveLetter?.value || '',
            isExisting: newUserDb?.isExistingDataDrive
        },
        logFileConfig: {
            fileName: newUserDb?.newUserLogFileName,
            volumeSize:
                newUserDb?.newUserLogFileSizeUnit === 'TiB'
                    ? newUserDb?.newUserLogFileSize * 1024
                    : newUserDb?.newUserLogFileSize,
            drive: newUserDb?.driveLetterLogFile?.value || '',
            isExisting: newUserDb?.isExistingLogDrive
        }
    };
    return payload;
};

export const isValidDatabaseName = (name: any) => {
    if (name && name.length > 0 && (name.length > 30 || !/^[a-zA-Z0-9/_]+$/.test(name))) {
        return false;
    }
    return true;
};

export const handleCreateUserDb = (state: any, dispatch: any) => {
    let payload;
    dispatch(setDbCreatePressed(true));
    dispatch(setDbCreateHit(Math.random()));
    if (state.auth.isDemoMode) {
        payload = createUserDbPayload(state?.createNewUser);
    } else {
        const dbNameStateValue =
            !state?.createNewUser?.newUserDBName || !isValidDatabaseName(state?.createNewUser?.newUserDBName);
        const dbDataNameStateValue = !state?.createNewUser?.newUserDBFileName;
        const dbLogNameStateValue = !state?.createNewUser?.newUserLogFileName;
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

        //Check for Create DB username values
        if (dbNameStateValue) {
            dispatch(setDbCreateNameAdded(false));
        } else {
            dispatch(setDbCreateNameAdded(true));
        }
        if (dbDataNameStateValue) {
            dispatch(setDbCreateDataNameAdded(false));
        } else {
            dispatch(setDbCreateDataNameAdded(true));
        }
        if (dbLogNameStateValue) {
            dispatch(setDbCreateLogNameAdded(false));
        } else {
            dispatch(setDbCreateLogNameAdded(true));
        }
        if (dbDataSizeState) {
            dispatch(setDbCreateDataSizeValid(false));
        } else {
            dispatch(setDbCreateDataSizeValid(true));
        }
        if (dbLogSizeState) {
            dispatch(setDbCreateLogSizeValid(false));
        } else {
            dispatch(setDbCreateLogSizeValid(true));
        }

        if (!dbNameStateValue && !dbDataNameStateValue && !dbLogNameStateValue && !dbDataSizeState && !dbLogSizeState) {
            if (newDriveLettersState()) {
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.ERROR,
                        message: GENERAL.DRIVE_LETTER_QUICK_CREATE_ERROR
                    })
                );
            } else if (driveLettersState) {
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.ERROR,
                        message: GENERAL.DRIVE_LETTER_CREATE_ERROR
                    })
                );
            } else {
                payload = createUserDbPayload(state?.createNewUser);
            }
        }
    }
    return payload;
};
