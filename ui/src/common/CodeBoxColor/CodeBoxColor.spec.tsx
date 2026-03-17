import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import CodeBoxColor from './CodeBoxColor';

const mockIsWorkloadFactory = { isWorkloadFactory: false };

vi.mock('../../store/storeHooks', () => ({
    useAppSelector: vi.fn((selector: any) => selector({ auth: mockIsWorkloadFactory }))
}));

vi.mock('../../utils/apiService', () => ({
    getBaseUrl: vi.fn().mockReturnValue('https://api.example.com')
}));

vi.mock('../../utils/consts', () => ({
    CRED_PLACEHOLDERS: { TOKEN: '<Token>' }
}));

describe('CodeBoxColor', () => {
    it('should be a defined component', () => {
        expect(CodeBoxColor).toBeDefined();
    });

    it('should render with required props', () => {
        const { container } = render(
            <CodeBoxColor credID="cred-123" region="us-east-1" actualData={{ key: 'value' }} endpoint="/api/endpoint" />
        );
        expect(container).toBeTruthy();
    });

    it('should render with dbType=mssql (default)', () => {
        const { container } = render(
            <CodeBoxColor
                credID="cred-123"
                region="us-east-1"
                actualData={{ key: 'value' }}
                endpoint="/api/endpoint"
                dbType="mssql"
            />
        );
        expect(container).toBeTruthy();
    });

    it('should render with dbType=oracle', () => {
        const { container } = render(
            <CodeBoxColor
                credID="cred-123"
                region="us-east-1"
                actualData={{ key: 'value' }}
                endpoint="/api/endpoint"
                dbType="oracle"
            />
        );
        expect(container).toBeTruthy();
    });

    it('should render with different dbTypes', () => {
        for (const dbType of ['mssql', 'oracle', 'postgresql']) {
            const { container } = render(
                <CodeBoxColor
                    credID="cred-123"
                    region="us-east-1"
                    actualData={{ key: 'value', number: 42, bool: true }}
                    endpoint="/api/endpoint"
                    dbType={dbType}
                />
            );
            expect(container).toBeTruthy();
        }
    });

    it('should render nothing when actualData is null/falsy', () => {
        const { container } = render(
            <CodeBoxColor credID="cred-123" region="us-east-1" actualData={null} endpoint="/api/endpoint" />
        );
        // actualData falsy → renderProperties returns null, outer `actualData &&` is false
        expect(container.firstChild).toBeNull();
    });

    it('should render number values with info color', () => {
        const { container } = render(
            <CodeBoxColor
                credID="cred-123"
                region="us-east-1"
                actualData={{ port: 1433, timeout: 30 }}
                endpoint="/api/endpoint"
            />
        );
        expect(container).toBeTruthy();
        // valueCheckColor: isNum=true → renders infoColor div
        expect(container.innerHTML).toContain('1433');
        expect(container.innerHTML).toContain('30');
    });

    it('should render boolean values with bool color', () => {
        const { container } = render(
            <CodeBoxColor
                credID="cred-123"
                region="us-east-1"
                actualData={{ enabled: true, debug: false }}
                endpoint="/api/endpoint"
            />
        );
        expect(container).toBeTruthy();
        // valueCheckColor: isBool=true → renders boolColor div
        expect(container.innerHTML).toContain('true');
        expect(container.innerHTML).toContain('false');
    });

    it('should render string values with green color', () => {
        const { container } = render(
            <CodeBoxColor
                credID="cred-123"
                region="us-east-1"
                actualData={{ host: 'my-server.aws.com', user: 'admin' }}
                endpoint="/api/endpoint"
            />
        );
        expect(container).toBeTruthy();
        // valueCheckColor: default → renders green40Color div with quoted value
        expect(container.innerHTML).toContain('my-server.aws.com');
    });

    it('should render array values with nested object items', () => {
        const { container } = render(
            <CodeBoxColor
                credID="cred-123"
                region="us-east-1"
                actualData={{
                    tags: [
                        { key: 'env', value: 'prod' },
                        { key: 'team', value: 'db' }
                    ]
                }}
                endpoint="/api/endpoint"
            />
        );
        expect(container).toBeTruthy();
        // Array branch with object items → renders key/value pair divs
        expect(container.innerHTML).toContain('env');
        expect(container.innerHTML).toContain('prod');
    });

    it('should render array values with primitive items', () => {
        const { container } = render(
            <CodeBoxColor
                credID="cred-123"
                region="us-east-1"
                actualData={{ ports: ['5432', '3306'] }}
                endpoint="/api/endpoint"
            />
        );
        expect(container).toBeTruthy();
        // Array branch with non-object items → renders singleArrayItem div
        expect(container.innerHTML).toContain('5432');
    });

    it('should render nested object values', () => {
        const { container } = render(
            <CodeBoxColor
                credID="cred-123"
                region="us-east-1"
                actualData={{ config: { host: 'db.local', port: 5432 } }}
                endpoint="/api/endpoint"
            />
        );
        expect(container).toBeTruthy();
        // typeof value === 'object' → renders blue50Color and recursively calls renderProperties
        expect(container.innerHTML).toContain('config');
        expect(container.innerHTML).toContain('db.local');
    });

    it('should render falsy non-boolean values with red color', () => {
        const { container } = render(
            <CodeBoxColor
                credID="cred-123"
                region="us-east-1"
                actualData={{ emptyStr: '', zeroVal: 0 }}
                endpoint="/api/endpoint"
            />
        );
        expect(container).toBeTruthy();
        // !value && typeof value !== 'boolean' → red20Color branch
    });

    it('should highlight credID placeholder', () => {
        const { container } = render(
            <CodeBoxColor
                credID="<CredentialId>"
                region="us-east-1"
                actualData={{ key: 'val' }}
                endpoint="/api/endpoint"
            />
        );
        expect(container).toBeTruthy();
        // textContent is unescaped; innerHTML escapes < > as &lt; &gt;
        expect(container.textContent).toContain('<CredentialId>');
    });

    it('should highlight region placeholder', () => {
        const { container } = render(
            <CodeBoxColor credID="cred-123" region="<Region>" actualData={{ key: 'val' }} endpoint="/api/endpoint" />
        );
        expect(container).toBeTruthy();
        expect(container.textContent).toContain('<Region>');
    });

    it('should include x-netapp-referer header when isWorkloadFactory is false', () => {
        const { container } = render(
            <CodeBoxColor credID="cred-123" region="us-east-1" actualData={{ key: 'val' }} endpoint="/api/endpoint" />
        );
        expect(container.innerHTML).toContain('x-netapp-referer');
    });

    it('should omit x-netapp-referer header when isWorkloadFactory is true', () => {
        mockIsWorkloadFactory.isWorkloadFactory = true;
        const { container } = render(
            <CodeBoxColor credID="cred-123" region="us-east-1" actualData={{ key: 'val' }} endpoint="/api/endpoint" />
        );
        expect(container.innerHTML).not.toContain('x-netapp-referer');
        mockIsWorkloadFactory.isWorkloadFactory = false; // reset
    });
});
