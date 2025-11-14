import { generateSignedUrls } from '../../src/operations/template-operations';
import { DEFAULT_AWS_REGION, DatabaseTypes } from '../../src/utils/consts';

describe('template operations', () => {
    it('get signed urls', async () => {
        const resp = await generateSignedUrls(DEFAULT_AWS_REGION, DatabaseTypes.MS_SQL_SERVER);
        expect(resp).toBeDefined();
    });
});
