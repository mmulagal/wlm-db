import { createStore } from '@reduxjs/toolkit';
import msSqlActionSlice, {
    setCreatePressed,
    setVPCSelectedValue,
    setAZSelectedValue,
    setDBCredentialPasswordValue,
    setActiveDirectoryValue,
    setFSXNNameValue,
    setDBNameValue
} from './msSqlActionSlice'; // Update this with the correct file path

describe('msSqlActionSlice', () => {
    let store: any;

    beforeEach(() => {
        store = createStore(msSqlActionSlice.reducer);
    });

    test('should set isCreatePressed correctly', () => {
        store.dispatch(setCreatePressed(true));
        expect(store.getState().isCreatePressed).toEqual(true);

        store.dispatch(setCreatePressed(false));
        expect(store.getState().isCreatePressed).toEqual(false);
    });

    test('should set vpcSelected correctly', () => {
        store.dispatch(setVPCSelectedValue(true));
        expect(store.getState().vpcSelected).toEqual(true);

        store.dispatch(setVPCSelectedValue(false));
        expect(store.getState().vpcSelected).toEqual(false);
    });

    test('should set availabilityZoneSelected correctly', () => {
        store.dispatch(setAZSelectedValue(true));
        expect(store.getState().availabilityZoneSelected).toEqual(true);

        store.dispatch(setAZSelectedValue(false));
        expect(store.getState().availabilityZoneSelected).toEqual(false);
    });

    test('should set dbCredentialPasswordSelected correctly', () => {
        store.dispatch(setDBCredentialPasswordValue(true));
        expect(store.getState().dbCredentialPasswordSelected).toEqual(true);

        store.dispatch(setDBCredentialPasswordValue(false));
        expect(store.getState().dbCredentialPasswordSelected).toEqual(false);
    });

    test('should set activeDirectorySelected correctly', () => {
        store.dispatch(setActiveDirectoryValue(true));
        expect(store.getState().activeDirectorySelected).toEqual(true);

        store.dispatch(setActiveDirectoryValue(false));
        expect(store.getState().activeDirectorySelected).toEqual(false);
    });

    test('should set fsxNNameSelected correctly', () => {
        store.dispatch(setFSXNNameValue(true));
        expect(store.getState().fsxNNameSelected).toEqual(true);

        store.dispatch(setFSXNNameValue(false));
        expect(store.getState().fsxNNameSelected).toEqual(false);
    });

    test('should set dbNameSelected correctly', () => {
        store.dispatch(setDBNameValue(true));
        expect(store.getState().dbNameSelected).toEqual(true);

        store.dispatch(setDBNameValue(false));
        expect(store.getState().dbNameSelected).toEqual(false);
    });
});
