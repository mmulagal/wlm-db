export interface Credentials {
    credentialsId?: string;
    name?: string;
    arn?: string;
    providerAccountId?: string;
}

export interface Regions {
    regionCode?: string;
    regionName?: string;
}

export interface VPC {
    id?: string;
    name?: string;
    cidrBlock?: [
        {
            CidrBlock?: String;
        }
    ];
    subnets: [];
    securityGroups?: [];
}

export interface SG {
    id?: string;
    description?: string;
    vpcId?: string;
    name?: string;
    securityGroupName?: string;
    ipPermissions?: [];
}

export interface AD {
    id?: string;
    dnsIpAddress?: Array<string>;
    domainName?: string;
    status?: string;
    vpcSettings?: {
        securityGroupId?: string;
    };
}

export interface Ami {
    name: string;
    imageId: string;
    architecture?: string;
}

export interface SNS {
    topicArn: string;
}

export interface KmsKeys {
    id: string;
    name?: string;
    origin?: string;
    state?: string;
    expirationDate?: string;
    formattedDate?: string;
    cellProps?: Object;
    default?: boolean;
}

export interface KeyPairs {
    id?: string;
    name?: string;
}

export interface SavedConfiguration {
    id: string;
    name: string;
    user: string;
    creationTime: number;
}

export interface InstanceType {
    instanceType?: string;
    vCpus?: number;
    ramInMib?: number;
    iopsInMbps?: number;
    architecture?: Array<string>;
}

export interface FSxN {
    fileSystemId?: string;
    name?: string;
    lifecycle?: string;
    securityGroups?: Array<string>;
    subnetIds?: Array<string>;
    kmsKeyId?: string;
    ontapConfiguration?: {
        deploymentType?: string;
        throughputCapacity?: number;
        preferredSubnetId?: string;
        diskIopsConfiguration?: {
            iops: string;
            mode: string;
        };
    };
    storageVirtualMachines?: [];
}

export interface MssqlEntities {
    getPolicies: {
        policiesList: {
            view?: {};
            operate?: {};
        } | null;
        policiesLoading: false;
        policiesError: null;
    };
    getThroughputRegions: any;
    getCredentials: {
        credentialData: Credentials[] | null;
        credentialLoading: false;
        credentialError: null;
    };
    getRegions: {
        regionsData: { regions?: Regions[] } | null;
        regionsLoading: false;
        regionsError: null;
    };
    getVPCList: {
        vpcData: { vpcs?: VPC[] };
        vpcLoading: false;
        vpcError: null;
    };
    getSGList: {
        sgData: { securityGroups?: SG[] };
        sgLoading: false;
        sgError: null;
    };
    getAdsList: {
        adsData: { directories?: AD[] };
        adsLoading: false;
        adsError: null;
    };
    getAmiList: {
        amiData: { amis?: Ami[] };
        amiLoading: false;
        amiError: null;
    };
    getCustomAmiList: {
        customAmiData: { amis?: Ami[] };
        customAmiLoading: false;
        customAmiError: null;
    };
    getSnsList: {
        snsData: { topics?: SNS[] };
        snsLoading: false;
        snsError: null;
    };
    getKmsList: {
        kmsData: KmsKeys[];
        kmsLoading: false;
        kmsError: null;
    };
    getKeyPairList: {
        keyPairData: { keyPairs?: KeyPairs[] };
        keyPairLoading: false;
        keyPairError: null;
    };
    getInstanceTypeList: {
        instanceTypeData: { instanceTypes?: InstanceType[] };
        instanceTypeLoading: false;
        instanceTypeError: null;
    };
    getFsxnList: {
        fsxnData: { filesystems?: FSxN[] };
        fsxnLoading: false;
        fsxnError: null;
    };
    getSavedConfigList: {
        configData: SavedConfiguration[];
        configLoading: false;
        configError: null;
    };
    getCollationList: {
        collationList: any;
        collationListLoading: false;
        collationListError: null;
    };
}

export interface Subnets {
    id: string;
    state: string;
    cidrBlock: string;
    availabilityZone: string;
    availableIps: number;
    name?: string;
}

export interface AvailabilityZonesObj {
    [key: string]: Subnets[];
}

export interface TagObj {
    key: string;
    value: string;
}

export interface MssqlRequestBody {
    [x: string]: any;
    networkConfiguration: {
        vpcId: string;
        vpcCidr: string;
        availabilityZone1: string;
        privateSubnet1Id: string;
        routeTable1Id: string;
        availabilityZone2: string;
        privateSubnet2Id: string;
        routeTable2Id: string;
    };
    ec2Configuration: {
        workloadInstanceType: string;
        keyPairName: string;
    };
    adConfiguration: {
        adScenarioType: string;
        domainUsername: string;
        domainPassword: string;
        domainDnsname: string;
        dnsIpaddress: string;
        securityGroupId: string;
    };
    fsxConfiguration: {
        fsxDeploymentMode: string;
        fsxFileSystemId: string;
        fsxUsername: string;
        fsxPassword: string;
        databaseSize: string;
        ontapSgGroupId: Array<string>;
        fsxVolThroughput: string;
        fsxIOPS: string;
        encryptionKey: string;
        snapshotPolicy: string;
    };
    sqlConfiguration: {
        sqlDeploymentMode: string;
        sqlAmiId: string;
        sqlAmiName: string;
        serviceAccountName: string;
        serviceAccountPassword: string;
        sqlCollation: string;
        sqlServerName: string;
    };
    topicArn?: string;
    enableCloudWatch?: boolean;
    tags?: Array<TagObj>;
}
