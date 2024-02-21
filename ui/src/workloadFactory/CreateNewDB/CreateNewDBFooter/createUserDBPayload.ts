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

export const handleCreateUserDb = (state: any) => {
    let payload;
    if (state.auth.isDemoMode) {
        payload = createUserDbPayload(state);
    } else {
        // ToDo: logic for missing fields, or if database name is already exist
        payload = createUserDbPayload(state);
    }
    return payload;
};
