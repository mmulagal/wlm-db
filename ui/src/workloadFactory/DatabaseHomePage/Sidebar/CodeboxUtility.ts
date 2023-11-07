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
