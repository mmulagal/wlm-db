import { DBType } from './consts';

export const initialJobMonitorColState = {
    0: {
        isHidden: false,
        isRemovalDisabled: true
    },
    1: {
        isHidden: false,
        isRemovalDisabled: true
    },
    2: {
        isHidden: false,
        isRemovalDisabled: true
    },
    3: {
        isHidden: false
    },
    4: {
        isHidden: false
    },
    5: {
        isHidden: false
    },

    6: {
        isHidden: false
    },
    7: {
        isHidden: false
    },
    8: {
        isHidden: true
    },
    9: {
        isHidden: true
    },
    11: {
        isHidden: true
    },
    10: {
        isHidden: false
    }
};

export const getInitialHostTableColState = (selectedHostType: string) => {
    if (selectedHostType === DBType.ORACLE) {
        return {
            0: { isHidden: false, isRemovalDisabled: true },
            1: { isHidden: false },
            2: { isHidden: false },
            3: { isHidden: false },
            4: { isHidden: false },
            5: { isHidden: false },
            6: { isHidden: false },
            7: { isHidden: false },
            8: { isHidden: false },
            9: { isHidden: false },
            10: { isHidden: false }
        };
    }
    // MSSQL/PGSQL
    return {
        0: { isHidden: false, isRemovalDisabled: true },
        1: { isHidden: false },
        2: { isHidden: false },
        3: { isHidden: false },
        4: { isHidden: false },
        5: { isHidden: false },
        6: { isHidden: false },
        7: { isHidden: false },
        8: { isHidden: false }
    };
};

export const getInitialDatabaseTableColState = (selectedHostType: string) => {
    if (selectedHostType === DBType.ORACLE) {
        return {
            1: { isHidden: false, isRemovalDisabled: true },
            2: { isHidden: false },
            3: { isHidden: false },
            4: { isHidden: false },
            5: { isHidden: false },
            6: { isHidden: false },
            7: { isHidden: false },
            8: { isHidden: false },
            9: { isHidden: false }
        };
    }
    if (selectedHostType === DBType.POSTGRESQL || selectedHostType === DBType.MSSQL) {
        return {
            1: { isHidden: false, isRemovalDisabled: true },
            2: { isHidden: false },
            3: { isHidden: false },
            4: { isHidden: false },
            5: { isHidden: false },
            6: { isHidden: false },
            7: { isHidden: false },
            8: { isHidden: false },
            9: { isHidden: false },
            10: { isHidden: false },
            11: { isHidden: false },
            12: { isHidden: false },
            13: { isHidden: false }
        };
    }
};

export const getInitialInstanceTableColState = (selectedHostType: string) => {
    if (selectedHostType === DBType.ORACLE) {
        return {
            1: { isHidden: false, isRemovalDisabled: true },
            2: { isHidden: false },
            3: { isHidden: false },
            4: { isHidden: false },
            5: { isHidden: false },
            6: { isHidden: false },
            7: { isHidden: false },
            8: { isHidden: false },
            9: { isHidden: false },
            10: { isHidden: false },
            11: { isHidden: false },
            12: { isHidden: false },
            13: { isHidden: false },
            14: { isHidden: false },
            15: { isHidden: false },
            16: { isHidden: false, isRemovalDisabled: true }
        };
    }
    if (selectedHostType === DBType.POSTGRESQL) {
        return {
            1: { isHidden: false, isRemovalDisabled: true },
            2: { isHidden: false },
            3: { isHidden: false },
            4: { isHidden: false },
            5: { isHidden: false },
            6: { isHidden: false },
            7: { isHidden: false },
            8: { isHidden: false },
            9: { isHidden: false },
            10: { isHidden: false, isRemovalDisabled: true }
        };
    }
    // Default: MSSQL (all columns 1-13, last isRemovalDisabled)
    return {
        1: { isHidden: false, isRemovalDisabled: true },
        2: { isHidden: false },
        3: { isHidden: false },
        4: { isHidden: false },
        5: { isHidden: false },
        6: { isHidden: false },
        7: { isHidden: false },
        9: { isHidden: false },
        10: { isHidden: false },
        11: { isHidden: false },
        12: { isHidden: false },
        13: { isHidden: false, isRemovalDisabled: true },
        14: { isHidden: false }
    };
};

export const initialDashboardInnerPageOptimizeColState = {
    1: {
        isHidden: false,
        isRemovalDisabled: true
    },
    2: {
        isHidden: false,
        isRemovalDisabled: true
    },
    3: {
        isHidden: false,
        isRemovalDisabled: true
    },
    4: {
        isHidden: false
    },
    5: {
        isHidden: false
    },

    6: {
        isHidden: true
    },
    7: {
        isHidden: true
    },
    8: {
        isHidden: false,
        isRemovalDisabled: true
    }
};
