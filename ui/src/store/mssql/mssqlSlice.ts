import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { MssqlEntities } from '../../utils/types/mssqlTypes';

const initialState: MssqlEntities = {
    getCredentials: {
        credentialData: null,
        credentialLoading: false,
        credentialError: null
    },
    getRegions: {
        regionsData: null,
        regionsLoading: false,
        regionsError: null
    },
    getVPCList: {
        vpcData: {},
        vpcLoading: false,
        vpcError: null
    },
    getSGList: {
        sgData: {},
        sgLoading: false,
        sgError: null
    },
    getAdsList: {
        adsData: {},
        adsLoading: false,
        adsError: null
    },
    getAmiList: {
        amiData: {},
        amiLoading: false,
        amiError: null
    },
    getSnsList: {
        snsData: {},
        snsLoading: false,
        snsError: null
    },
    getKmsList: {
        kmsData: [],
        kmsLoading: false,
        kmsError: null
    },
    getKeyPairList: {
        keyPairData: {},
        keyPairLoading: false,
        keyPairError: null
    },
    getInstanceTypeList: {
        instanceTypeData: {},
        instanceTypeLoading: false,
        instanceTypeError: null
    },
    getFsxnList: {
        fsxnData: {},
        fsxnLoading: false,
        fsxnError: null
    },
    getSavedConfigList: {
        configData: [],
        configLoading: false,
        configError: null
    }
};

const mssqlSlice = createSlice({
    name: 'mssql',
    initialState,
    reducers: {
        addCredentials: (state, action: PayloadAction<any>) => {
            state.getCredentials = action.payload;
        },
        addRegions: (state, action: PayloadAction<any>) => {
            state.getRegions = action.payload;
        },
        addVpcList: (state, action: PayloadAction<any>) => {
            state.getVPCList = action.payload;
        },
        addSGList: (state, action: PayloadAction<any>) => {
            state.getSGList = action.payload;
        },
        addAdsList: (state, action: PayloadAction<any>) => {
            state.getAdsList = action.payload;
        },
        addAmiList: (state, action: PayloadAction<any>) => {
            state.getAmiList = action.payload;
        },
        addSnsList: (state, action: PayloadAction<any>) => {
            state.getSnsList = action.payload;
        },
        addKmsKeysList: (state, action: PayloadAction<any>) => {
            state.getKmsList = action.payload;
        },
        addKeyPairList: (state, action: PayloadAction<any>) => {
            state.getKeyPairList = action.payload;
        },
        addInstanceTypeList: (state, action: PayloadAction<any>) => {
            state.getInstanceTypeList = action.payload;
        },
        addFsxnList: (state, action: PayloadAction<any>) => {
            state.getFsxnList = action.payload;
        },
        addSavedConfigList: (state, action: PayloadAction<any>) => {
            state.getSavedConfigList = action.payload;
        }
    }
});

export const {
    addCredentials,
    addRegions,
    addVpcList,
    addSGList,
    addAdsList,
    addAmiList,
    addSnsList,
    addKmsKeysList,
    addKeyPairList,
    addInstanceTypeList,
    addFsxnList,
    addSavedConfigList
} = mssqlSlice.actions;
export default mssqlSlice;
