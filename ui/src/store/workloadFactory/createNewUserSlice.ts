import { PayloadAction, createSlice } from '@reduxjs/toolkit';

const initialCreateNewUserState: any = {
    selectedNewUserConfig: 'Quick Create',
    newUserDBName: ''
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
        }
    }
});

export const { setSelectedNewUserConfig, setNewUserDBName } = createNewUserSlice.actions;

export default createNewUserSlice;
