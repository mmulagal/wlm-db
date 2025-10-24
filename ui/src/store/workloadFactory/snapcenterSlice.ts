import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { SnapCenterEntities, UserCredentials } from '../../utils/types/snapCenterTypes';

export interface ProtectionProcessStatus {
    step1Status: 'idle' | 'running' | 'done';
    step2Status: 'idle' | 'running' | 'done';
}

export interface ProtectionProcessState {
    [key: string]: ProtectionProcessStatus;
}

export const initialSandboxState: SnapCenterEntities = {
    selectedAgent: [],
    dataMap: {},
    workSpaceData: {},
    protectionProcessState: {},
    protectionHosts: {},
    instanceProtection: {},
    databaseProtection: {},
    credentials: {
        username: '',
        password: ''
    },
    authVerification: false,
    alreadyExistAgentId: ''
};

const snapCenterSlice = createSlice({
    name: 'snapCenter',
    initialState: initialSandboxState,
    reducers: {
        setAlreadyExistAgentId: (state, action: PayloadAction<any>) => {
            state.alreadyExistAgentId = action.payload;
        },
        setAuthVerification: (state, action: PayloadAction<any>) => {
            state.authVerification = action.payload;
        },
        startProtectionStep1: (state, action: PayloadAction<string>) => {
            const key = action.payload;
            state.protectionProcessState[key] ??= {
                step1Status: 'idle',
                step2Status: 'idle'
            };
            state.protectionProcessState[key].step1Status = 'running';
            state.protectionProcessState[key].step2Status = 'idle';
        },
        completeProtectionStep1: (state, action: PayloadAction<string>) => {
            const key = action.payload;
            if (state.protectionProcessState[key]) {
                state.protectionProcessState[key].step1Status = 'done';
                state.protectionProcessState[key].step2Status = 'running';
            }
        },
        completeProtectionStep2: (state, action: PayloadAction<string>) => {
            const key = action.payload;
            if (state.protectionProcessState[key]) {
                state.protectionProcessState[key].step2Status = 'done';
            }
        },
        resetProtectionProcess: (state, action: PayloadAction<string>) => {
            const key = action.payload;
            state.protectionProcessState[key] = {
                step1Status: 'idle',
                step2Status: 'idle'
            };
        },

        setWorkSpaceData: (state, action: PayloadAction<any>) => {
            state.workSpaceData = action.payload;
        },
        setSelectedAgent: (state, action: PayloadAction<any>) => {
            state.selectedAgent = action.payload;
        },
        setSCCredentials: (state, action: PayloadAction<Partial<UserCredentials>>) => {
            state.credentials = {
                ...state.credentials,
                ...action.payload
            };
        },
        setDataForRow: (state, action) => {
            const { key, stepData } = action.payload;
            if (!state.dataMap[key]) {
                state.dataMap[key] = {};
            }
            state.dataMap[key] = {
                ...state.dataMap[key],
                ...stepData
            };
        },
        clearDataForRow: (state, action) => {
            delete state.dataMap[action.payload.key];
        },
        cancelProtectionForRow: (state, action) => {
            const key = action.payload;
            if (state.dataMap[key]) {
                state.dataMap[key].cancelled = true;
            }
        },
        clearDataMap: state => {
            state.dataMap = {};
        },
        // Record hosts returned by listExistingHosts
        upsertProtectionHosts: (state, action: PayloadAction<any[]>) => {
            action.payload?.forEach((host: any) => {
                const key = host?.name?.toLowerCase();
                if (key) {
                    state.protectionHosts[key] = {
                        id: host?.id,
                        name: host?.name,
                        lastFetched: Date.now()
                    };
                }
            });
        },
        // Batch update instance protection statuses discovered per host
        upsertInstanceProtectionBatch: (state, action: PayloadAction<{ items: any[] }>) => {
            action.payload?.items?.forEach((inst: any) => {
                const hostFqdn = inst.host.toLowerCase();
                if (!hostFqdn) return;
                const hostShort = hostFqdn.split('.')[0];
                const apiInstanceName = inst.name.toLowerCase();
                if (!apiInstanceName) return;

                // Derive short instance name if API returns host\\instance
                const instanceShort = apiInstanceName.includes('\\')
                    ? apiInstanceName.split('\\').pop() || apiInstanceName
                    : apiInstanceName;
                const isProtected =
                    (typeof inst?.status === 'string' && inst.status.toLowerCase() === 'protected') ||
                    (Array.isArray(inst?.policies) && inst.policies.length > 0);

                const keys = new Set<string>();
                // Base keys
                keys.add(`${hostFqdn}::${apiInstanceName}`);
                keys.add(`${hostShort}::${apiInstanceName}`);
                // Short instance variant
                keys.add(`${hostFqdn}::${instanceShort}`);
                keys.add(`${hostShort}::${instanceShort}`);

                // Default MSSQLSERVER case -> instance name equals host short
                keys.add(`${hostFqdn}::${hostShort}`);
                keys.add(`${hostShort}::${hostShort}`);

                keys.forEach(k => {
                    state.instanceProtection[k] = {
                        protected: isProtected,
                        lastFetched: Date.now()
                    };
                });
            });
        },
        // Batch update database protection statuses discovered per host
        upsertDatabaseProtectionBatch: (state, action: PayloadAction<{ items: any[] }>) => {
            action.payload?.items?.forEach((db: any) => {
                const hostFqdn = (db?.host || '').toLowerCase();
                if (!hostFqdn) return;
                const hostShort = hostFqdn.split('.')[0];
                const apiInstanceName = (db?.instance || '').toLowerCase();
                const instanceShort = apiInstanceName.includes('\\')
                    ? (apiInstanceName.split('\\').pop() || '').toLowerCase()
                    : apiInstanceName;
                const dbName = (db?.name || '').toLowerCase();
                if (!dbName) return;

                const statusVal = (db?.status || '').toLowerCase();
                const isProtected = statusVal === 'protected';

                const keys = new Set<string>();
                // Full
                if (apiInstanceName) {
                    keys.add(`${hostFqdn}::${apiInstanceName}::${dbName}`);
                    keys.add(`${hostShort}::${apiInstanceName}::${dbName}`);
                }
                // Short instance variant
                if (instanceShort) {
                    keys.add(`${hostFqdn}::${instanceShort}::${dbName}`);
                    keys.add(`${hostShort}::${instanceShort}::${dbName}`);
                }
                // Default MSSQLSERVER fallback
                keys.add(`${hostFqdn}::mssqlserver::${dbName}`);
                keys.add(`${hostShort}::mssqlserver::${dbName}`);

                keys.forEach(k => {
                    state.databaseProtection[k] = {
                        protected: isProtected,
                        lastFetched: Date.now()
                    };
                });
            });
        }
    }
});

export const {
    setAlreadyExistAgentId,
    setAuthVerification,
    setWorkSpaceData,
    setSelectedAgent,
    setSCCredentials,
    setDataForRow,
    clearDataForRow,
    startProtectionStep1,
    cancelProtectionForRow,
    resetProtectionProcess,
    completeProtectionStep1,
    completeProtectionStep2,
    clearDataMap,
    upsertProtectionHosts,
    upsertInstanceProtectionBatch,
    upsertDatabaseProtectionBatch
} = snapCenterSlice.actions;

export default snapCenterSlice;
