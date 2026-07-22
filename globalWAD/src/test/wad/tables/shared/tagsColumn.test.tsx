import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { createTagsColumn, SHARED_TAGS_COLUMN_ID } from '@wad/tables/shared/tagsColumn';
import { createMockResource } from '@test/helpers/testUtils';

describe('tagsColumn', () => {
    it('creates a tags column with the shared id', () => {
        expect(createTagsColumn().id).toBe(SHARED_TAGS_COLUMN_ID);
    });

    it('renders a view button that calls onView with the row', () => {
        const onView = vi.fn();
        const column = createTagsColumn({ onView });
        const row = createMockResource('resource-1');

        render(column.Renderer!({ row }));

        fireEvent.click(screen.getByText('View'));
        expect(onView).toHaveBeenCalledWith(row);
    });

    it('renders nothing when onView is not provided', () => {
        const column = createTagsColumn();
        const { container } = render(column.Renderer!({ row: createMockResource('resource-1') }));

        expect(container).toBeEmptyDOMElement();
    });
});
