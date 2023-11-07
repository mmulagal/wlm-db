import { TemplateRes } from "../../../utils/types/databaseHomeTypes";
import { MssqlRequestBody } from "../../../utils/types/mssqlTypes";

export const setMaskedPassword = (data: MssqlRequestBody) => {
    const maskedPassword = {
        ...data,
        dbCredentials: {
            ...data.dbCredentials,
            password: data.dbCredentials.password.length ? '******' : ''
        },
        fsxN: { ...data.fsxN, fsxNPassword: data.fsxN.fsxNPassword.length ? '*****' : '' },
        activeDirectory: {
            ...data.activeDirectory,
            password: data.activeDirectory.password.length ? '*****' : ''
        }
    };
    return maskedPassword
}

export const addEscapeInCli = (data: TemplateRes) => {
    // escape character is being removed so adding that again in cli command
    const result = { ...data,
        cliCommand: data?.cliCommand ? data.cliCommand.replace(/"/g, '\\"') : ''
    }
    return result;
}
