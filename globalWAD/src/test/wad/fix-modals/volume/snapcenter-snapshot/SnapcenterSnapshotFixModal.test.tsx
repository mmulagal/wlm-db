import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { SnapcenterSnapshotFixModal } from '@wad/fix-modals/volume/snapcenter-snapshot/SnapcenterSnapshotFixModal';
import { volumeFixModalProps } from '@test/helpers/testUtils';

describe('SnapcenterSnapshotFixModal', () => {
    it('closes when cancel is clicked', () => {
        const props = volumeFixModalProps();
        render(<SnapcenterSnapshotFixModal {...props} />);

        fireEvent.click(screen.getByTestId('wlmdb-snapcenter-snapshot-fix-close-btn'));

        expect(props.close).toHaveBeenCalledOnce();
    });
});
