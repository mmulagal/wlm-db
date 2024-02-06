import { StatusRes } from './databaseHomeTypes';
import { Credentials, Regions } from './mssqlTypes';

export interface HeaderTypeEntities {
    headerSelectedCred: any;
    headerSelectedRegion: any;
    getCredentials: {
        credentialData: Credentials[] | null;
        credentialLoading: false;
        credentialError: null;
    };
    getRegions: {
        regionsData: { regions?: Regions[] } | null;
        regionsLoading: false;
        regionsError: null;
    };
    getStatus: {
        statusData: StatusRes | null;
        statusLoading: false;
        statusError: null;
    };
    refreshTime: string | null;
}
