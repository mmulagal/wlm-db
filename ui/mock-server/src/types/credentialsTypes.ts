export interface CredentialsRes {
    [index: number]: {
        credentialsId: string;
        name: string;
        arn: string;
        providerAccountId: string;
    };
}
