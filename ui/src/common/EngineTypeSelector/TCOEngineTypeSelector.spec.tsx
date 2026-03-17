import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import TCOEngineTypeSelector from './TCOEngineTypeSelector';

vi.mock('i18next', () => ({
    t: (key: string) => key
}));

vi.mock('../../store/storeHooks', () => ({
    useAppSelector: vi.fn().mockReturnValue({ selectedTCOHostType: 'MSSQL' }),
    useAppDispatch: () => vi.fn()
}));

vi.mock('../../store/workloadFactory/exploreSavingsSlice', () => ({
    setSelectedTCOHostType: vi.fn((val: any) => ({ type: 'setSelectedTCOHostType', payload: val }))
}));

describe('TCOEngineTypeSelector', () => {
    it('should be a defined component', () => {
        expect(TCOEngineTypeSelector).toBeDefined();
    });

    it('should render without crashing', () => {
        const { container } = render(<TCOEngineTypeSelector />);
        expect(container).toBeTruthy();
    });

    it('should render a second time without errors', () => {
        const { container } = render(<TCOEngineTypeSelector />);
        expect(container.innerHTML).toBeTruthy();
    });

    it('should render again without errors', () => {
        const { container } = render(<TCOEngineTypeSelector />);
        expect(container.firstChild).not.toBeNull();
    });
});
