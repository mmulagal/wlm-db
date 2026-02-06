import { BASE_URL, generateResponse } from '../utils/appUtils';
import StorageSavings from '../data/storageSavings.json';
import StorageSavingsBulk from '../data/storageSavingsBulk.json';
import StorageSavingsFsxw from '../data/storageSavingsFsxw.json';
import ViewCalculations from '../data/viewCalculations.json';
import ViewCalculationsBulk from '../data/viewCalculationsBulk.json';
import ViewCalculationsFsxw from '../data/viewCalculationsFsxw.json';
import UploadScript from '../data/uploadScript.json';
import SendEmail from '../data/sendEmail.json';
import ExploreSavingsOnPrem from '../data/exploreSavingsOnPrem.json';
import OnPremCalculationsBulk from '../data/onPremCalculationsBulk.json';

const router = require('express').Router();

router.post(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/instances/:instanceId/storage-savings/ebs`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, StorageSavings);
        }, 100);
    }
);

router.post(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/storage-savings/ebs`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, StorageSavingsBulk);
        }, 100);
    }
);

router.get(`${BASE_URL}/v1/mssql/onprem-tco/resources`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, ExploreSavingsOnPrem);
    }, 100);
});

router.post(`${BASE_URL}/v1/mssql/onprem-tco/explore-savings`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, OnPremCalculationsBulk);
    }, 100);
});

router.post(`${BASE_URL}/v1/mssql/regions/:region/manual-storage-savings/ebs`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, StorageSavings);
    }, 50);
});

router.get(`${BASE_URL}/v1/oracle/onprem-tco/collector`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, {
            downloadLink: ''
        });
    }, 50);
});

router.post(`${BASE_URL}/v1/mssql/onprem/upload`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, UploadScript);
    }, 50);
});

router.post(`${BASE_URL}/v1/notification/email?emailType=savings-calculations`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, SendEmail);
    }, 50);
});

router.delete(`${BASE_URL}/v1/mssql/onprem-tco/resources/:resourceId`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, {
            count: 1
        });
    }, 50);
});

router.post(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/instances/:instanceId/storage-savings/ebs/calculations`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, ViewCalculations);
        }, 50);
    }
);

router.post(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/storage-savings/ebs/calculations`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, ViewCalculationsBulk);
        }, 50);
    }
);

router.post(
    `${BASE_URL}/v1/mssql/regions/:region/manual-storage-savings/ebs/calculations`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            // generateResponse(res, 200, ViewCalculations);
            generateResponse(res, 200, ViewCalculations);
        }, 50);
    }
);

router.post(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/instances/:instanceId/storage-savings/fsxw`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, StorageSavingsFsxw);
        }, 50);
    }
);

router.post(`${BASE_URL}/v1/mssql/regions/:region/manual-storage-savings/fsxw`, async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, StorageSavingsFsxw);
    }, 50);
});

router.post(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/instances/:instanceId/storage-savings/fsxw/calculations`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, ViewCalculationsFsxw);
        }, 50);
    }
);

router.post(
    `${BASE_URL}/v1/mssql/regions/:region/manual-storage-savings/fsxw/calculations`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            // generateResponse(res, 200, ViewCalculations);
            generateResponse(res, 200, ViewCalculationsFsxw);
        }, 50);
    }
);

export default router;
