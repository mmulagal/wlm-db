import { memo, useCallback } from 'react';
import { Button } from '@netapp/bxp-design-system-react';
import type { ResourceScanRecord, TableColumn } from '@tlveng/workload-factory-components';

export const SHARED_TAGS_COLUMN_ID = 'tags';

interface TagsCellRendererProps {
    row: ResourceScanRecord;
    onView?: ((resource: ResourceScanRecord) => void) | undefined;
}

const TagsCellRenderer = memo(({ row, onView }: TagsCellRendererProps) => {
    const handleClick = useCallback(() => {
        onView?.(row);
    }, [onView, row]);

    if (!onView) return null;

    return (
        <Button variant="text" onClick={handleClick} isDisabled={row.isDismissed}>
            View
        </Button>
    );
});
TagsCellRenderer.displayName = 'TagsCellRenderer';

export interface CreateTagsColumnOptions {
    onView?: ((resource: ResourceScanRecord) => void) | undefined;
}

export const createTagsColumn = ({ onView }: CreateTagsColumnOptions = {}): TableColumn<ResourceScanRecord> => ({
    id: SHARED_TAGS_COLUMN_ID,
    header: 'Tags',
    accessor: 'metadata.tags',
    width: 150,
    sort: { enabled: false },
    Renderer: ({ row }) => <TagsCellRenderer row={row} onView={onView} />
});
