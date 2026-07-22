import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { ResourceTagsDialog } from '@wad/tables/shared/dialogs/ResourceTagsDialog';
import { createMockResource } from '@test/helpers/testUtils';

describe('ResourceTagsDialog', () => {
    it('renders tags from resource metadata', () => {
        render(
            <ResourceTagsDialog
                resource={createMockResource('resource-1', {
                    metadata: { tags: [{ key: 'env', value: 'dev' }] }
                })}
                onClose={vi.fn()}
            />
        );

        expect(screen.getByTestId('key-value-table')).toHaveTextContent('1');
    });

    it('shows loader while tags are pending', () => {
        render(<ResourceTagsDialog isOpen tags={[]} isPending onClose={vi.fn()} />);

        expect(screen.getByTestId('InlineLoader')).toBeInTheDocument();
    });

    it('calls onClose when close is clicked', () => {
        const onClose = vi.fn();
        render(<ResourceTagsDialog isOpen tags={[]} onClose={onClose} />);

        fireEvent.click(screen.getByText('Close'));
        expect(onClose).toHaveBeenCalledOnce();
    });
});
