import { TemplateRes } from '../../../utils/types/databaseHomeTypes';
import { MssqlRequestBody } from '../../../utils/types/mssqlTypes';

export const setMaskedPassword = (data: MssqlRequestBody) => {
    const maskedPassword = {
        ...data,
        dbCredentials: {
            ...data?.dbCredentials,
            password: data?.dbCredentials?.password?.length ? '******' : ''
        },
        fsxN: { ...data?.fsxN, fsxNPassword: data?.fsxN?.fsxNPassword?.length ? '*****' : '' },
        activeDirectory: {
            ...data?.activeDirectory,
            password: data?.activeDirectory?.password?.length ? '*****' : ''
        }
    };
    return maskedPassword;
};

export const addEscapeInCli = (data: TemplateRes) => {
    // escape character is being removed so adding that again in cli command
    const result = { ...data, cliCommand: data?.cliCommand ? data.cliCommand.replace(/"/g, '\\"') : '' };
    return result;
};

export const maskAwsCli = (data: string | undefined) => {
    if (!data) {
        return data;
    }
    let updatedStr = data;
    let domainAdminRegex = /DomainAdminPassword\\",ParameterValue=\\"(.*?)\\" ParameterKey=/;
    updatedStr = updatedStr.replace(domainAdminRegex, (match, p1) => {
        if (p1 && p1 !== '') {
            return 'DomainAdminPassword\\",ParameterValue=\\"****\\" ParameterKey=';
        } else {
            return 'DomainAdminPassword\\",ParameterValue=\\"\\" ParameterKey=';
        }
    });

    let fsxAdminRegex = /FSxAdminPassword\\",ParameterValue=\\"(.*?)\\" ParameterKey=/;
    updatedStr = updatedStr.replace(fsxAdminRegex, (match, p1) => {
        if (p1 && p1 !== '') {
            return 'FSxAdminPassword\\",ParameterValue=\\"****\\" ParameterKey=';
        } else {
            return 'FSxAdminPassword\\",ParameterValue=\\"\\" ParameterKey=';
        }
    });

    let sqlServiceAccRegex = /SQLServiceAccountPassword\\",ParameterValue=\\"(.*?)\\" ParameterKey=/;
    updatedStr = updatedStr.replace(sqlServiceAccRegex, (match, p1) => {
        if (p1 && p1 !== '') {
            return 'SQLServiceAccountPassword\\",ParameterValue=\\"****\\" ParameterKey=';
        } else {
            return 'SQLServiceAccountPassword\\",ParameterValue=\\"\\" ParameterKey=';
        }
    });

    return updatedStr;
};
