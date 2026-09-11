export interface CredentialsRes {
    items: {
        credentialsId: string;
        name: string;
        arn: string;
        providerAccountId: string;
    }[];
}
