
export interface Credentials {
    credentialsId: string,
    name: string,
    arn: string,
    providerAccountId: string
}

export interface VPC {
    id: string
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
