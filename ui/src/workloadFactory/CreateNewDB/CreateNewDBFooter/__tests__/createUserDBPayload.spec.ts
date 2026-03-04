import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createUserDbPayload, isValidDatabaseName, isValidFileName, handleCreateUserDb } from '../createUserDBPayload';

// Mock store actions
vi.mock('../../../../store/mssql/msSqlActionSlice', () => ({
    setDbCreateDataNameAdded: vi.fn(val => ({ type: 'setDbCreateDataNameAdded', payload: val })),
    setDbCreateDataSizeValid: vi.fn(val => ({ type: 'setDbCreateDataSizeValid', payload: val })),
    setDbCreateHit: vi.fn(val => ({ type: 'setDbCreateHit', payload: val })),
    setDbCreateLogNameAdded: vi.fn(val => ({ type: 'setDbCreateLogNameAdded', payload: val })),
    setDbCreateLogSizeValid: vi.fn(val => ({ type: 'setDbCreateLogSizeValid', payload: val })),
    setDbCreateNameAdded: vi.fn(val => ({ type: 'setDbCreateNameAdded', payload: val })),
    setDbCreatePressed: vi.fn(val => ({ type: 'setDbCreatePressed', payload: val }))
}));

vi.mock('../../../../store/notificationSlice', () => ({
    NOTIFICATION_TYPES: { ERROR: 'error', INFO: 'info' },
    addNotification: vi.fn(val => ({ type: 'addNotification', payload: val }))
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: {
        DB_QUICK_CREATE: 'Quick create',
        DB_ADVANCED_CREATE: 'Advanced create',
        DRIVE_LETTER_QUICK_CREATE_ERROR: 'Quick create drive letter error',
        DRIVE_LETTER_CREATE_ERROR: 'Drive letter create error',
        COLLATION_ERROR: 'Collation error',
        ACTION_REQUIRED: 'Action required'
    }
}));

describe('createUserDbPayload', () => {
    it('should build a correct payload with all fields provided', () => {
        const newUserDb = {
            newUserDBName: 'TestDB',
            newUserDBFileName: 'testfile',
            newUserDataSizeUnit: { label: 'GiB' },
            newUserDataSize: 10,
            driveLetter: { value: 'C' },
            isExistingDataDrive: true,
            isDataVirtualMountPoint: false,
            newUserLogFileName: 'testlogfile',
            newUserLogFileSizeUnit: { label: 'GiB' },
            newUserLogFileSize: 2,
            driveLetterLogFile: { value: 'D' },
            isExistingLogDrive: false,
            isLogVirtualMountPoint: true,
            selectedCollation: { label: 'SQL_Latin1' },
            instanceId: 'inst-001'
        };

        const result = createUserDbPayload(newUserDb);

        expect(result.databaseName).toBe('TestDB');
        expect(result.dataFileConfig.fileName).toBe('testfile.mdf');
        expect(result.dataFileConfig.volumeSize).toBe(10);
        expect(result.dataFileConfig.drive).toBe('C');
        expect(result.dataFileConfig.isExisting).toBe(true);
        expect(result.dataFileConfig.isVirtualMount).toBe(false);
        expect(result.logFileConfig.fileName).toBe('testlogfile.ldf');
        expect(result.logFileConfig.volumeSize).toBe(2);
        expect(result.logFileConfig.drive).toBe('D');
        expect(result.logFileConfig.isExisting).toBe(false);
        expect(result.logFileConfig.isVirtualMount).toBe(true);
        expect(result.collation).toBe('SQL_Latin1');
        expect(result.databaseInstanceId).toBe('inst-001');
    });

    it('should convert TiB to GiB for data size', () => {
        const newUserDb = {
            newUserDataSizeUnit: { label: 'TiB' },
            newUserDataSize: 2,
            newUserLogFileSizeUnit: { label: 'GiB' },
            newUserLogFileSize: 5
        };
        const result = createUserDbPayload(newUserDb);
        expect(result.dataFileConfig.volumeSize).toBe(2048);
    });

    it('should convert TiB to GiB for log size', () => {
        const newUserDb = {
            newUserDataSizeUnit: { label: 'GiB' },
            newUserDataSize: 10,
            newUserLogFileSizeUnit: { label: 'TiB' },
            newUserLogFileSize: 1
        };
        const result = createUserDbPayload(newUserDb);
        expect(result.logFileConfig.volumeSize).toBe(1024);
    });

    it('should return empty string for fileName when newUserDBFileName is empty', () => {
        const newUserDb = {
            newUserDBFileName: '',
            newUserLogFileName: ''
        };
        const result = createUserDbPayload(newUserDb);
        expect(result.dataFileConfig.fileName).toBe('');
        expect(result.logFileConfig.fileName).toBe('');
    });

    it('should return empty string for drive when driveLetter is not set', () => {
        const newUserDb = { driveLetter: null, driveLetterLogFile: null };
        const result = createUserDbPayload(newUserDb);
        expect(result.dataFileConfig.drive).toBe('');
        expect(result.logFileConfig.drive).toBe('');
    });

    it('should return empty string for collation when not set', () => {
        const newUserDb = { selectedCollation: null };
        const result = createUserDbPayload(newUserDb);
        expect(result.collation).toBe('');
    });

    it('should handle undefined newUserDb gracefully', () => {
        const result = createUserDbPayload(undefined);
        expect(result.databaseName).toBeUndefined();
        expect(result.collation).toBe('');
    });
});

describe('isValidDatabaseName', () => {
    it('should return true for a valid name', () => {
        expect(isValidDatabaseName('ValidDB123')).toBe(true);
    });

    it('should return true for empty string', () => {
        expect(isValidDatabaseName('')).toBe(true);
    });

    it('should return true for null', () => {
        expect(isValidDatabaseName(null)).toBe(true);
    });

    it('should return true for undefined', () => {
        expect(isValidDatabaseName(undefined)).toBe(true);
    });

    it('should return false for name exceeding 123 characters', () => {
        const longName = 'a'.repeat(124);
        expect(isValidDatabaseName(longName)).toBe(false);
    });

    it('should return false for name with invalid characters', () => {
        expect(isValidDatabaseName('invalid name!')).toBe(false);
    });

    it('should return false for name with spaces', () => {
        expect(isValidDatabaseName('invalid name')).toBe(false);
    });

    it('should return true for name with exactly 123 characters', () => {
        const exactName = 'a'.repeat(123);
        expect(isValidDatabaseName(exactName)).toBe(true);
    });

    it('should return true for name with allowed special chars / and _', () => {
        expect(isValidDatabaseName('DB/Name_123')).toBe(true);
    });

    it('should return false for name with special characters like @', () => {
        expect(isValidDatabaseName('DB@Name')).toBe(false);
    });
});

describe('isValidFileName', () => {
    it('should return true for a valid filename', () => {
        expect(isValidFileName('validfile123')).toBe(true);
    });

    it('should return true for empty string', () => {
        expect(isValidFileName('')).toBe(true);
    });

    it('should return true for null', () => {
        expect(isValidFileName(null)).toBe(true);
    });

    it('should return true for undefined', () => {
        expect(isValidFileName(undefined)).toBe(true);
    });

    it('should return false for filename exceeding 128 characters', () => {
        const longName = 'a'.repeat(129);
        expect(isValidFileName(longName)).toBe(false);
    });

    it('should return false for filename with invalid characters', () => {
        expect(isValidFileName('invalid file!')).toBe(false);
    });

    it('should return true for filename with exactly 128 characters', () => {
        const exactName = 'a'.repeat(128);
        expect(isValidFileName(exactName)).toBe(true);
    });

    it('should return true for filename with allowed special chars / and _', () => {
        expect(isValidFileName('file/name_123')).toBe(true);
    });
});

describe('handleCreateUserDb', () => {
    let dispatch: any;

    beforeEach(() => {
        dispatch = vi.fn();
    });

    const baseState = {
        auth: { isDemoMode: false },
        createNewUser: {
            newUserDBName: 'TestDB',
            newUserDBFileName: 'testdata',
            newUserLogFileName: 'testlog',
            newUserDataSize: 10,
            isDataSizeValid: true,
            newUserLogFileSize: 2,
            isLogSizeValid: true,
            driveLetter: { value: 'C' },
            driveLetterLogFile: { value: 'D' },
            selectedCollation: { label: 'SQL_Latin1' },
            selectedNewUserConfig: 'Advanced create',
            driveInfoListLoading: false,
            driveInfoList: null,
            newUserDataSizeUnit: { label: 'GiB' },
            newUserLogFileSizeUnit: { label: 'GiB' },
            isExistingDataDrive: false,
            isDataVirtualMountPoint: false,
            isExistingLogDrive: false,
            isLogVirtualMountPoint: false,
            instanceId: 'inst-001'
        }
    };

    it('should return payload when all fields are valid', () => {
        const result = handleCreateUserDb(baseState, dispatch);
        expect(result).toBeDefined();
        expect(result.databaseName).toBe('TestDB');
    });

    it('should dispatch setDbCreatePressed(true) on every call', () => {
        handleCreateUserDb(baseState, dispatch);
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'setDbCreatePressed' }));
    });

    it('should dispatch setDbCreateHit on every call', () => {
        handleCreateUserDb(baseState, dispatch);
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'setDbCreateHit' }));
    });

    it('should return payload in demo mode without validations', () => {
        const demoState = {
            ...baseState,
            auth: { isDemoMode: true },
            createNewUser: {
                ...baseState.createNewUser,
                newUserDBName: '',
                newUserDBFileName: '',
                newUserLogFileName: ''
            }
        };
        const result = handleCreateUserDb(demoState, dispatch);
        expect(result).toBeDefined();
    });

    it('should dispatch setDbCreateNameAdded(false) when dbName is missing', () => {
        const state = {
            ...baseState,
            createNewUser: { ...baseState.createNewUser, newUserDBName: '' }
        };
        handleCreateUserDb(state, dispatch);
        expect(dispatch).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'setDbCreateNameAdded', payload: false })
        );
    });

    it('should dispatch setDbCreateDataNameAdded(false) when data file name is missing', () => {
        const state = {
            ...baseState,
            createNewUser: { ...baseState.createNewUser, newUserDBFileName: '' }
        };
        handleCreateUserDb(state, dispatch);
        expect(dispatch).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'setDbCreateDataNameAdded', payload: false })
        );
    });

    it('should dispatch setDbCreateLogNameAdded(false) when log file name is missing', () => {
        const state = {
            ...baseState,
            createNewUser: { ...baseState.createNewUser, newUserLogFileName: '' }
        };
        handleCreateUserDb(state, dispatch);
        expect(dispatch).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'setDbCreateLogNameAdded', payload: false })
        );
    });

    it('should dispatch setDbCreateDataSizeValid(false) when data size is missing', () => {
        const state = {
            ...baseState,
            createNewUser: { ...baseState.createNewUser, newUserDataSize: 0 }
        };
        handleCreateUserDb(state, dispatch);
        expect(dispatch).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'setDbCreateDataSizeValid', payload: false })
        );
    });

    it('should dispatch setDbCreateLogSizeValid(false) when log size is missing', () => {
        const state = {
            ...baseState,
            createNewUser: { ...baseState.createNewUser, newUserLogFileSize: 0 }
        };
        handleCreateUserDb(state, dispatch);
        expect(dispatch).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'setDbCreateLogSizeValid', payload: false })
        );
    });

    it('should dispatch drive letter quick create error notification when quick create lacks drives', () => {
        const state = {
            ...baseState,
            createNewUser: {
                ...baseState.createNewUser,
                selectedNewUserConfig: 'Quick create',
                driveInfoListLoading: false,
                driveInfoList: { availableDriveLetters: ['C'] } // less than 2
            }
        };
        handleCreateUserDb(state, dispatch);
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'addNotification' }));
    });

    it('should dispatch drive letter create error when drive letters are not selected', () => {
        const state = {
            ...baseState,
            createNewUser: {
                ...baseState.createNewUser,
                driveLetter: null,
                driveLetterLogFile: null
            }
        };
        handleCreateUserDb(state, dispatch);
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'addNotification' }));
    });

    it('should dispatch collation error when collation is missing', () => {
        const state = {
            ...baseState,
            createNewUser: {
                ...baseState.createNewUser,
                selectedCollation: null
            }
        };
        handleCreateUserDb(state, dispatch);
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'addNotification' }));
    });

    it('should return undefined when validation fails', () => {
        const state = {
            ...baseState,
            createNewUser: { ...baseState.createNewUser, newUserDBName: '' }
        };
        const result = handleCreateUserDb(state, dispatch);
        expect(result).toBeUndefined();
    });

    it('should return undefined when invalid db name is provided', () => {
        const state = {
            ...baseState,
            createNewUser: { ...baseState.createNewUser, newUserDBName: 'a'.repeat(124) }
        };
        const result = handleCreateUserDb(state, dispatch);
        expect(result).toBeUndefined();
    });

    it('should return undefined when invalid data file name is provided', () => {
        const state = {
            ...baseState,
            createNewUser: { ...baseState.createNewUser, newUserDBFileName: 'a'.repeat(129) }
        };
        const result = handleCreateUserDb(state, dispatch);
        expect(result).toBeUndefined();
    });

    it('should not error in quick create when driveInfoList is null', () => {
        const state = {
            ...baseState,
            createNewUser: {
                ...baseState.createNewUser,
                selectedNewUserConfig: 'Quick create',
                driveInfoList: null
            }
        };
        // Should not throw - driveInfoList being null means the quick create drive check is skipped
        expect(() => handleCreateUserDb(state, dispatch)).not.toThrow();
    });

    it('should succeed in quick create with enough available drives', () => {
        const state = {
            ...baseState,
            createNewUser: {
                ...baseState.createNewUser,
                selectedNewUserConfig: 'Quick create',
                driveInfoList: { availableDriveLetters: ['C', 'D'] }
            }
        };
        const result = handleCreateUserDb(state, dispatch);
        expect(result).toBeDefined();
    });
});
