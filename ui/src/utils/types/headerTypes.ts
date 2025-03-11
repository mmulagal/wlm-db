import { StatusRes } from './databaseHomeTypes';
import { Credentials, Regions } from './mssqlTypes';

export interface HeaderTypeEntities {
    multiSelectData: any;
    headerSelectedCred: any;
    headerSelectedCredSandbox: any;
    headerSelectedRegionSandbox: any;
    headerSelectedRegion: any;
    headerSelectedMultiCred: any;
    headerSelectedMultiRegion: any;
    headerSelectedMultiCredIdsList: any;
    headerSelectedMultiRegionIdsList: any;
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
    credentialMapping: any;
    regionMapping: any;
    getStatus: {
        statusData: StatusRes | null;
        statusLoading: false;
        statusError: null;
    };
    refreshTime: string | null;
    dashboardRefresh: boolean;
    multiSelectStatus: any;
}
