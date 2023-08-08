
export interface CreateMssqlTemplateRes {
    cloudFormationUrl: string;
    warningMessage: string;
}

export interface DeployMssqlTemplate {
    cloudFormationStackId: string;
}