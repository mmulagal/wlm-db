export interface ManageReadinessSection {
    missingSqlPermissions?: string[];
    missingModules: string[];
    missingPermissions?: string[];
}

export interface ManageReadinessData {
    [key: string]: ManageReadinessSection;
}

export interface ManageStates {
    installMissingAWS: boolean;
    installMissingAWSList: string[];
    installMissingPowershell?: boolean;
    installMissingJQ?: boolean;
    assessment: string;
    remediation: string;
    dbcreation: string;
    sandbox: string;
    errorInvestigation: string;
    ec2InstanceId: string;
    region: string;
    credentialsId: string;
    databaseInstanceName: string;
    manageReadinessData?: ManageReadinessData;
}

export interface BulkDetectedInstance {
    ec2InstanceId?: string;
    region?: string;
    credentialsId?: string;
    databaseInstanceName?: string;
    data?: {
        ec2InstanceId?: string;
        regionId?: string;
        credentialId?: string;
        databaseInstanceName?: string;
        manageReadiness?: ManageReadinessData;
        [key: string]: any;
    };
    manageStates?: ManageStates;
    [key: string]: any;
}

export interface ManageApiPayloadItem {
    ec2InstanceId: string;
    region: string;
    credentialsId: string;
    databaseInstanceNames: string[];
    modulesToInstall: string[];
}

export interface ManageApiPayload {
    items: ManageApiPayloadItem[];
}

export interface SubJobMetadata {
    ec2InstanceId?: string;
    credentialsId?: string;
    region?: string;
    resourceId?: string;
    instanceManagementStatus?: {
        databaseInstanceName: string;
        status: string;
    }[];
    [key: string]: any;
}

export interface SubJob {
    status: string;
    metadata: SubJobMetadata;
    resourceName?: string;
    credentialsId?: string;
    region?: { code: string };
    [key: string]: any;
}

export interface JobResponse {
    data: {
        status: string;
        subJobs?: SubJob[];
        [key: string]: any;
    };
}

export interface WizardState {
    submit: any;
    ontapUserNameFromWizard?: string;
    ontapPasswordFromWizard?: string;
    mssqlUserNameFromWizard?: string;
    mssqlPasswordFromWizard?: string;
    windowsAuthenticationUsernameFromWizard?: string;
    windowsAuthenticationPasswordFromWizard?: string;
    asmUserNameFromWizard?: string;
    asmPasswordFromWizard?: string;
    authenticationTypeSelected?: string;
    hitNext?: boolean;
    installMissingAWS?: boolean;
    installMissingAWSList?: string[];
    installMissingPowershell?: boolean;
    installMissingJQ?: boolean;
}

export interface UseWizardReturn {
    state: WizardState;
    setState: (update: Partial<WizardState>) => void;
    currentStepIndex?: number;
    currentStep?: string;
    gotoPreviousStep?: () => void;
    goToNextStep?: () => void;
}

export interface ExtendedManageStates extends ManageStates {
    overallState?: string;
    readyCount?: number;
    perRowState?: any[];
}

export type RegisterResourceCredResult = {
    data?: { databaseServerError?: string; fsxnError?: string; manageReadiness?: ManageReadinessData };
    error?: any;
};

export interface RegisterDetail {
    resourceId: string;
    databaseCount: string;
    databaseServerEdition: string;
    databaseServerError: string;
    fsxnError: string;
    requiredModuleError: string;
    manageReadiness: ManageReadinessData; // Adjust type if you have a specific structure
}

export interface RegisterResourceCredBulkResultItem {
    ec2InstanceId: string;
    credentialsId: string;
    region: string;
    error: string;
    registerDetails: RegisterDetail[];
}
