import { ProtectionProcessState } from '../../store/workloadFactory/snapcenterSlice';

export interface UserCredentials {
    username: string;
    password: string;
    ssmParameterArn?: string;
}

export interface SnapCenterEntities {
    alreadyExistAgentId: string;
    selectedAgent: any;
    dataMap: any;
    workSpaceData: any;
    protectionProcessState: ProtectionProcessState;
    protectionHosts: Record<string, any>;
    instanceProtection: Record<string, { protected: boolean; lastFetched: number }>;
    databaseProtection?: Record<string, { protected: boolean; lastFetched: number }>;
    credentials: UserCredentials;
    authVerification: boolean;
}
