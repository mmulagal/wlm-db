
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
    cidrBlock?: string
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
        vpcData: VPC[],
        vpcLoading: false,
        vpcError: null
    },
    getAdsList: {
        adData: AD[],
        adLoading: false,
        adError: null
    },
    getAmiList: {
        amiData: Ami[],
        amiLoading: false,
        amiError: null
    },
}


export interface MssqlFormEntities {
    credentials?: Credentials,
    regions?: Regions,
    existingVpc?: VPC,
    newVpcName?: string
}
