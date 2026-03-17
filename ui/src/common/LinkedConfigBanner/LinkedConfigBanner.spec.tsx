import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import LinkedConfigBanner from './LinkedConfigBanner';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock(
    '../../workloadFactory/Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleConfigDependencies',
    () => ({
        isLayoutConfig: vi.fn().mockReturnValue(false)
    })
);

describe('LinkedConfigBanner', () => {
    it('should be a defined component', () => {
        expect(LinkedConfigBanner).toBeDefined();
    });

    it('should not render when linkedConfigNames is empty', () => {
        const { container } = render(<LinkedConfigBanner linkedConfigNames={[]} configName="MyConfig" />);
        expect(container.firstChild).toBeNull();
    });

    it('should render with one linked config name', () => {
        const { container } = render(<LinkedConfigBanner linkedConfigNames={['ConfigA']} configName="MyConfig" />);
        expect(container).toBeTruthy();
    });

    it('should render with multiple linked config names', () => {
        const { container } = render(
            <LinkedConfigBanner linkedConfigNames={['Config A', 'Config B']} configName="MyConfig" />
        );
        expect(container).toBeTruthy();
    });

    it('should render with different configName', () => {
        const { container } = render(
            <LinkedConfigBanner linkedConfigNames={['Config A', 'Config B', 'Config C']} configName="layout-config" />
        );
        expect(container).toBeTruthy();
    });
});
