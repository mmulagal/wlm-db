import { PayloadAction, createSlice } from '@reduxjs/toolkit';

const initialCreateNewUserState: any = {
    selectedNewUserConfig: 'Quick create',
    newUserDBName: '',
    newUserDataSize: '',
    newUserDataSizeUnit: '',
    newUserDBFileName: '',
    newUserLogFileName: '',
    newUserLogFileSize: '',
    newUserLogFileSizeUnit: '',
    driveLetter: '',
    driveLetterLogFile: ''
};

const createNewUserSlice = createSlice({
    name: 'createNewUser',
    initialState: initialCreateNewUserState,
    reducers: {
        setSelectedNewUserConfig: (state, action: PayloadAction<any>) => {
            state.selectedNewUserConfig = action.payload;
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
        }
    }
});

export const {
    setSelectedNewUserConfig,
    setNewUserDBName,
    setNewUserDataSize,
    setNewUserDataSizeUnit,
    setNewDBFileName,
    setNewUserLogFileName,
    setNewUserLogFileSize,
    setNewUserLogFileSizeUnit,
    setDriveLetter,
    setDriveLetterForLogFile
} = createNewUserSlice.actions;

export default createNewUserSlice;
