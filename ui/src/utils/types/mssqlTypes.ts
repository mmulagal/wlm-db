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
    securityGroups: [];
}

export interface AD {
    id?: string;
    dnsIpAddress?: Array<string>;
    domainName?: string;
}

export interface Ami {
    name: string;
    imageId: string;
}

export interface SNS {
    topicArn: string;
}

export interface KmsKeys {
    id?: string;
    name?: string;
    origin?: string;
    state?: string;
    expirationDate?: string;
}

export interface KeyPairs {
    id?: string;
    name?: string;
}

export interface InstanceType {
    instanceType?: string,
    vCpus?: number,
    ramInMib?: number,
    iopsInMbps?: number
}

export interface FSxN {
    fileSystemId?: string,
}


export interface MssqlEntities {
    getCredentials: {
        credentialData: Credentials[] | null;
        credentialLoading: false;
        credentialError: null;
    };
    getRegions: {
        regionsData: { regions?: Regions[] };
        regionsLoading: false;
        regionsError: null;
    };
    getVPCList: {
        vpcData: { vpcs?: VPC[] };
        vpcLoading: false;
        vpcError: null;
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
    getSnsList: {
        snsData: { Topics?: SNS[] };
        snsLoading: false;
        snsError: null;
    };
    getKmsList: {
        kmsData: { keys?: KmsKeys[] };
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
        fsxnData: { filesystems?: InstanceType[] };
        fsxnLoading: false;
        fsxnError: null;
    };
}
