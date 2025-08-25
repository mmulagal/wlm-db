export interface OracleEntities {
    selectedOracleInnerPageTab: string;
    visitedTabs: any;
    resourceDetails: any;
    resourceLoading: boolean;
    oracleDefaultFilterOptions: {} | any;
    oracleOptimizeFilterTags: [] | any;
    refreshOverview: boolean;
    refreshWellArchitect: boolean;
    refreshTimes: {
        overviewRefreshTime: string;
        optimizeRefreshTime: string;
    };
}
