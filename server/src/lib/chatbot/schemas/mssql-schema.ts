// User Intent from the query/request
type Intent = {
    intent: FunctionToRun | Query;
};
// If the user if asking a query, give a proper reply
type Query = {
    type: 'Query';
    response: string; // The response from the chatbot
};

type FunctionToRun = DeployMsSql;

// Parameters for MS SQL Deployment, use undefined as default value
type DeployMsSqlParams = {
    deploymentEnvironment?: string;
    credentialsId?: string;
    sqlDeploymentMode?: string;
    region?: string;
    vpcId?: string;
    vpcCidr?: string;
    availabilityZone1?: string;
    privateSubnet1Id?: string;
    availabilityZone2?: string;
    privateSubnet2Id?: string;
    routeTable1Id?: string;
    routeTable2Id?: string;
    fsxType?: string;
    workloadInstanceType?: string;
    keyPairName?: string;
    adScenarioType?: string;
    domainUsername?: string;
    domainPassword?: string;
    domainDnsname?: string;
    dnsIpaddress?: string;
    securityGroupId?: string;
    sqlServerName?: string;
    sqlAmiId?: string;
    serviceAccountName?: string;
    serviceAccountPassword?: string;
    fsxDeploymentMode?: string;
    fsxUsername?: string;
    fsxPassword?: string;
    databaseSize?: number;
    fsxVolThroughput?: number;
    fsxIOPS?: number;
    encryptionKey?: string;
    ontapSgGroupId?: string;
    fsxFileSystemId?: string;
    enableCloudWatch?: boolean;
    tags?: Array<{ key: string; value: string }>;
};

// Deploy MS SQL
type DeployMsSql = {
    type: 'DeployMsSql';
    params: DeployMsSqlParams;
};

export { Intent };
