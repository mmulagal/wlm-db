import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import AssessmentContainer from './AssessmentContainer';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('../../store/storeHooks', () => ({
    useAppSelector: vi.fn().mockReturnValue({ isNA: false })
}));

describe('AssessmentContainer', () => {
    it('should be a defined component', () => {
        expect(AssessmentContainer).toBeDefined();
    });

    it('should render with isLoading=false', () => {
        const { container } = render(
            <AssessmentContainer
                onClick={vi.fn()}
                isLoading={false}
                gwTimestamp=""
                gwAdhocError=""
                optimizePageLoading={false}
            />
        );
        expect(container).toBeTruthy();
    });

    it('should render with isLoading=true', () => {
        const { container } = render(
            <AssessmentContainer
                onClick={vi.fn()}
                isLoading
                gwTimestamp=""
                gwAdhocError=""
                optimizePageLoading={false}
            />
        );
        expect(container).toBeTruthy();
    });

    it('should render with gwAdhocError', () => {
        const { container } = render(
            <AssessmentContainer
                onClick={vi.fn()}
                isLoading={false}
                gwTimestamp="2024-01-01"
                gwAdhocError="Something went wrong"
                optimizePageLoading={false}
            />
        );
        expect(container).toBeTruthy();
    });

    it('should render with isWad=true', () => {
        const { container } = render(
            <AssessmentContainer
                onClick={vi.fn()}
                isLoading={false}
                gwTimestamp=""
                gwAdhocError=""
                optimizePageLoading={false}
                isWad
            />
        );
        expect(container).toBeTruthy();
    });
});
