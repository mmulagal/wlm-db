
export interface Credentials {
    credentialsId?: string,
    name?: string,
    arn?: string,
    providerAccountId?: string
}

export interface Regions {
    regionCode?: string,
    regionName?: string
}

export interface VPC {
    id?: string,
    name?: string,
    cidrBlock?: [
        {
            CidrBlock?: String
        }
    ]
}

export interface AD {
    id: string,
    dnsIpAddress: Array<string>,
    domainName: string
}

export interface Ami {
    name: string,
    imageId: string
}

export interface SNS {
    TopicArn: string,
}


export interface MssqlEntities {
    getCredentials: {
        credentialData: Credentials[],
        credentialLoading: false,
        credentialError: null
    },
    getRegions: {
        regionsData: {regions?: Regions[]},
        regionsLoading: false,
        regionsError: null
    },
    getVPCList: {
        vpcData: {vpcs?: VPC[]},
        vpcLoading: false,
        vpcError: null
    },
    getAdsList: {
        adData: {directories?: AD[]},
        adLoading: false,
        adError: null
    },
    getAmiList: {
        amiData: {amis?: Ami[]},
        amiLoading: false,
        amiError: null
    },
    getSnsList: {
        snsData: {Topics?: SNS[]},
        snsLoading: false,
        snsError: null
    },
}
