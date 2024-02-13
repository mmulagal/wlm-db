import { PayloadAction, createSlice } from '@reduxjs/toolkit';

const initialCreateNewUserState: any = {
    selectedNewUserConfig: 'Quick Create',
    newUserDBName: '',
    newUserDataSize: '',
    newUserDataSizeUnit: '',
    newUserDBFileName: '',
    newUserLogFileName: '',
    newUserLogFileSize: '',
    newUserLogFileSizeUnit: ''
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
    setNewUserLogFileSizeUnit
} = createNewUserSlice.actions;

export default createNewUserSlice;
