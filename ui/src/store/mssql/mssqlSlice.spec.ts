import { createStore } from '@reduxjs/toolkit';
import mssqlSlice, {
    addCredentials,
    addRegions,
    addVpcList,
    addAdsList,
    addAmiList,
    addSnsList,
    addKmsKeysList,
    addKeyPairList,
    addInstanceTypeList,
    addFsxnList
} from './mssqlSlice'; // Update this with the correct file path

describe('msSqlActionSlice', () => {
    let store: any;

    beforeEach(() => {
        store = createStore(mssqlSlice.reducer);
    });

    test('should set addCredentials correctly', () => {
        store.dispatch(
            addCredentials({
                credentialData: 'test',
                credentialLoading: false,
                credentialError: null
            })
        );
        expect(store.getState().getCredentials.credentialData).toEqual('test');
    });

    test('should set addRegions correctly', () => {
        store.dispatch(
            addRegions({
                regionsData: 'europe',
                regionsLoading: false,
                regionsError: null
            })
        );
        expect(store.getState().getRegions.regionsData).toEqual('europe');
    });

    test('should set addVpcList correctly', () => {
        store.dispatch(
            addVpcList({
                vpcData: {},
                vpcLoading: false,
                vpcError: null
            })
        );
        expect(store.getState().getVPCList.vpcLoading).toEqual(false);
    });

    test('should set addAdsList correctly', () => {
        store.dispatch(
            addAdsList({
                adsData: {},
                adsLoading: false,
                adsError: null
            })
        );
        expect(store.getState().getAdsList.adsError).toEqual(null);
    });

    test('should set addAmiList correctly', () => {
        store.dispatch(
            addAmiList({
                amiData: {},
                amiLoading: false,
                amiError: null
            })
        );
        expect(store.getState().getAmiList.amiData).toEqual({});
    });

    test('should set addSnsList correctly', () => {
        store.dispatch(
            addSnsList({
                snsData: {},
                snsLoading: false,
                snsError: null
            })
        );
        expect(store.getState().getSnsList.snsError).toEqual(null);
    });

    test('should set addKmsKeysList correctly', () => {
        store.dispatch(
            addKmsKeysList({
                kmsData: [],
                kmsLoading: false,
                kmsError: null
            })
        );
        expect(store.getState().getKmsList.kmsData).toEqual([]);
    });

    test('should set addKeyPairList correctly', () => {
        store.dispatch(
            addKeyPairList({
                keyPairData: {},
                keyPairLoading: false,
                keyPairError: null
            })
        );
        expect(store.getState().getKeyPairList.keyPairError).toEqual(null);
    });

    test('should set addInstanceTypeList correctly', () => {
        store.dispatch(
            addInstanceTypeList({
                instanceTypeData: {},
                instanceTypeLoading: false,
                instanceTypeError: null
            })
        );
        expect(store.getState().getInstanceTypeList.instanceTypeLoading).toEqual(false);
    });

    test('should set addFsxnList correctly', () => {
        store.dispatch(
            addFsxnList({
                fsxnData: {},
                fsxnLoading: false,
                fsxnError: null
            })
        );
        expect(store.getState().getFsxnList.fsxnData).toEqual({});
    });
});
