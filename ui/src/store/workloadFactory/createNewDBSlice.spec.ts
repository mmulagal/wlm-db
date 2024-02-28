import { createStore } from '@reduxjs/toolkit';
import createNewUserSlice, {
    setSelectedNewUserConfig,
    setDriveInfoList,
    setDriveInfoListLoading,
    setNewUserDBName,
    setNewUserDataSize,
    setNewUserDataSizeUnit,
    setNewDBFileName,
    setNewUserLogFileName,
    setNewUserLogFileSize,
    setNewUserLogFileSizeUnit,
    setDriveLetter,
    setDriveLetterForLogFile,
    setDBHostName,
    setIsExistingDataDrive,
    setIsExistingLogDrive,
    setIsDataSizeValid,
    setIsLogSizeValid,
    setSelectedCollation,
    addInitialDBCreateData
} from './createNewDBSlice'; // Update this with the correct file path

describe('create new DB slice', () => {
    let store: any;

    beforeEach(() => {
        store = createStore(createNewUserSlice.reducer);
    });

    test('should set selectedCollation correctly', () => {
        store.dispatch(setSelectedCollation('collation'));
        expect(store.getState().selectedCollation).toEqual('collation');
    });

    test('should set selectedNewUserConfig correctly', () => {
        store.dispatch(setSelectedNewUserConfig('Quick create'));
        expect(store.getState().selectedNewUserConfig).toEqual('Quick create');
    });

    test('should set driveInfoList correctly', () => {
        store.dispatch(setDriveInfoList([1]));
        expect(store.getState().driveInfoList).toEqual([1]);
    });

    test('should set setDriveInfoListLoading correctly', () => {
        store.dispatch(setDriveInfoListLoading(false));
        expect(store.getState().driveInfoListLoading).toEqual(false);
    });

    test('should set setNewUserDBName correctly', () => {
        store.dispatch(setNewUserDBName('User'));
        expect(store.getState().newUserDBName).toEqual('User');
    });

    test('should set setNewUserDataSize correctly', () => {
        store.dispatch(setNewUserDataSize('1 GiB'));
        expect(store.getState().newUserDataSize).toEqual('1 GiB');
    });

    test('should set setNewUserDataSizeUnit correctly', () => {
        store.dispatch(setNewUserDataSizeUnit('1 GiB'));
        expect(store.getState().newUserDataSizeUnit).toEqual('1 GiB');
    });

    test('should set setNewDBFileName correctly', () => {
        store.dispatch(setNewDBFileName('DB file'));
        expect(store.getState().newUserDBFileName).toEqual('DB file');
    });

    test('should set setNewUserLogFileName correctly', () => {
        store.dispatch(setNewUserLogFileName('log file'));
        expect(store.getState().newUserLogFileName).toEqual('log file');
    });

    test('should set setNewUserLogFileSize correctly', () => {
        store.dispatch(setNewUserLogFileSize('100'));
        expect(store.getState().newUserLogFileSize).toEqual('100');
    });

    test('should set setNewUserLogFileSizeUnit correctly', () => {
        store.dispatch(setNewUserLogFileSizeUnit('100'));
        expect(store.getState().newUserLogFileSizeUnit).toEqual('100');
    });

    test('should set setDriveLetter correctly', () => {
        store.dispatch(setDriveLetter('C:'));
        expect(store.getState().driveLetter).toEqual('C:');
    });

    test('should set setDriveLetterForLogFile correctly', () => {
        store.dispatch(setDriveLetterForLogFile('C:'));
        expect(store.getState().driveLetterLogFile).toEqual('C:');
    });

    test('should set setDBHostName correctly', () => {
        store.dispatch(setDBHostName('host'));
        expect(store.getState().dbHostName).toEqual('host');
    });

    test('should set setIsExistingDataDrive correctly', () => {
        store.dispatch(setIsExistingDataDrive('C:'));
        expect(store.getState().isExistingDataDrive).toEqual('C:');
    });

    test('should set setIsExistingLogDrive correctly', () => {
        store.dispatch(setIsExistingLogDrive('C:'));
        expect(store.getState().isExistingLogDrive).toEqual('C:');
    });

    test('should set setIsDataSizeValid correctly', () => {
        store.dispatch(setIsDataSizeValid(true));
        expect(store.getState().isDataSizeValid).toEqual(true);
    });

    test('should set setIsLogSizeValid correctly', () => {
        store.dispatch(setIsLogSizeValid(true));
        expect(store.getState().isLogSizeValid).toEqual(true);
    });
});
