import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { FixModalNumberedList } from '@wad/fix-modals/shared/fixModalStyles';

describe('fixModalStyles', () => {
    it('renders numbered list content', () => {
        render(
            <FixModalNumberedList dataTestId="numbered-list">
                <span>Step one</span>
            </FixModalNumberedList>
        );

        expect(screen.getByTestId('numbered-list')).toHaveTextContent('Step one');
    });
});
