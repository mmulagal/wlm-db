import { PayloadAction, createSlice } from '@reduxjs/toolkit';

export const initialCreateNewUserState: any = {
    selectedNewUserConfig: 'Quick create',
    driveInfoList: null,
    driveInfoListLoading: false,
    collationList: null,
    collationListLoading: false,
    newUserDBName: '',
    newUserDataSize: '',
    newUserDataSizeUnit: '',
    newUserDBFileName: '',
    newUserLogFileName: '',
    newUserLogFileSize: '',
    newUserLogFileSizeUnit: '',
    driveLetter: '',
    driveLetterLogFile: '',
    dbHostName: '',
    isExistingDataDrive: false,
    isExistingLogDrive: false,
    isDataSizeValid: true,
    isLogSizeValid: true,
    selectedCollation: {},
    isDataVirtualMountPoint: false,
    isLogVirtualMountPoint: false
};

const createNewUserSlice = createSlice({
    name: 'createNewUser',
    initialState: initialCreateNewUserState,
    reducers: {
        setSelectedCollation: (state, action: PayloadAction<any>) => {
            state.selectedCollation = action.payload;
        },
        setSelectedNewUserConfig: (state, action: PayloadAction<any>) => {
            state.selectedNewUserConfig = action.payload;
        },
        setDriveInfoList: (state, action: PayloadAction<any>) => {
            state.driveInfoList = action.payload;
        },
        setDriveInfoListLoading: (state, action: PayloadAction<any>) => {
            state.driveInfoListLoading = action.payload;
        },
        setCollationList: (state, action: PayloadAction<any>) => {
            state.collationList = action.payload;
        },
        setCollationListLoading: (state, action: PayloadAction<any>) => {
            state.collationListLoading = action.payload;
        },
        setNewUserDBName: (state, action: PayloadAction<any>) => {
            state.newUserDBName = action.payload;
        },
        setNewUserDataSize: (state, action: PayloadAction<any>) => {
            state.newUserDataSize = action.payload;
        },
        setNewUserDataSizeUnit: (state, action: PayloadAction<any>) => {
            state.newUserDataSizeUnit = action.payload;
        },
        setNewDBFileName: (state, action: PayloadAction<any>) => {
            state.newUserDBFileName = action.payload;
        },
        setNewUserLogFileName: (state, action: PayloadAction<any>) => {
            state.newUserLogFileName = action.payload;
        },
        setNewUserLogFileSize: (state, action: PayloadAction<any>) => {
            state.newUserLogFileSize = action.payload;
        },
        setNewUserLogFileSizeUnit: (state, action: PayloadAction<any>) => {
            state.newUserLogFileSizeUnit = action.payload;
        },
        setDriveLetter: (state, action: PayloadAction<any>) => {
            state.driveLetter = action.payload;
        },
        setDriveLetterForLogFile: (state, action: PayloadAction<any>) => {
            state.driveLetterLogFile = action.payload;
        },
        setDBHostName: (state, action: PayloadAction<any>) => {
            state.dbHostName = action.payload;
        },
        setIsExistingDataDrive: (state, action: PayloadAction<any>) => {
            state.isExistingDataDrive = action.payload;
        },
        setIsExistingLogDrive: (state, action: PayloadAction<any>) => {
            state.isExistingLogDrive = action.payload;
        },
        setIsDataSizeValid: (state, action: PayloadAction<any>) => {
            state.isDataSizeValid = action.payload;
        },
        setIsLogSizeValid: (state, action: PayloadAction<any>) => {
            state.isLogSizeValid = action.payload;
        },
        addInitialDBCreateData: (state, action: PayloadAction<any>) => {
            return { ...state, ...action.payload };
        },
        setIsDataVirtualMountPoint: (state, action: PayloadAction<any>) => {
            state.isDataVirtualMountPoint = action.payload;
        },
        setIsLogVirtualMountPoint: (state, action: PayloadAction<any>) => {
            state.isLogVirtualMountPoint = action.payload;
        }
    }
});

export const {
    setSelectedNewUserConfig,
    setDriveInfoList,
    setDriveInfoListLoading,
    setCollationList,
    setCollationListLoading,
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
    addInitialDBCreateData,
    setIsDataVirtualMountPoint,
    setIsLogVirtualMountPoint
} = createNewUserSlice.actions;

export default createNewUserSlice;
