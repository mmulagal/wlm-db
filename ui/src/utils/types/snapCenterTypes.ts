import { ProtectionProcessState } from '../../store/workloadFactory/snapcenterSlice';

export interface UserCredentials {
    username: string;
    password: string;
}

export interface SnapCenterEntities {
    selectedAgent: any;
    dataMap: any;
    workSpaceData: any;
    protectionProcessState: ProtectionProcessState;
    credentials: UserCredentials;
    authVerification: boolean;
}
