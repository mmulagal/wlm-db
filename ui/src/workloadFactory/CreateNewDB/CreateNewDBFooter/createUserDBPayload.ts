export const createUserDbPayload = (newUserDb: any) => {
    let payload = {
        databaseName: newUserDb?.newUserDBName,
        dataFileName: newUserDb?.newUserDBFileName,
        dataVolumeSize:
            newUserDb?.newUserDataSizeUnit === 'TiB' ? newUserDb?.newUserDataSize * 1024 : newUserDb?.newUserDataSize,
        dataDrive: newUserDb?.driveLetter?.value,
        logFileName: newUserDb?.newUserLogFileName,
        logVolumeSize:
            newUserDb?.newUserLogFileSizeUnit === 'TiB'
                ? newUserDb?.newUserLogFileSize * 1024
                : newUserDb?.newUserLogFileSize,
        logDrive: newUserDb?.driveLetterLogFile?.value
    };
    return payload;
};
