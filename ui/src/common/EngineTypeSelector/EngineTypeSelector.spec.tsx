import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import EngineTypeSelector from './EngineTypeSelector';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('i18next', () => ({
    t: (key: string) => key
}));

vi.mock('../../store/storeHooks', () => ({
    useAppSelector: vi.fn().mockReturnValue({ selectedHostType: 'MSSQL' }),
    useAppDispatch: () => vi.fn()
}));

vi.mock('../../store/workloadFactory/inventoryV2Slice', () => ({
    setSelectedHostType: vi.fn((val: any) => ({ type: 'setSelectedHostType', payload: val }))
}));

describe('EngineTypeSelector', () => {
    it('should be a defined component', () => {
        expect(EngineTypeSelector).toBeDefined();
    });

    it('should render without crashing', () => {
        const { container } = render(<EngineTypeSelector />);
        expect(container).toBeTruthy();
    });

    it('should render a second time without errors', () => {
        const { container } = render(<EngineTypeSelector />);
        expect(container.innerHTML).toBeTruthy();
    });

    it('should render again without errors', () => {
        const { container } = render(<EngineTypeSelector />);
        expect(container.firstChild).not.toBeNull();
    });
});
