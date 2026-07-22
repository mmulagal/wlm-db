import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { SnapshotPolicyFixModal } from '@wad/fix-modals/volume/snapshot-policy/SnapshotPolicyFixModal';
import { volumeFixModalProps } from '@test/helpers/testUtils';

describe('SnapshotPolicyFixModal', () => {
    it('shows mssql copy by default and fixes all resources on continue', () => {
        const props = volumeFixModalProps();
        render(<SnapshotPolicyFixModal {...props} />);

        expect(screen.getByText(/Microsoft SQL Server/)).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('wlmdb-snapshot-policy-fix-continue-btn'));

        expect(props.fix).toHaveBeenCalledWith(['vol-1'], {});
    });

    it('shows oracle copy when the first resource workload is oracle', () => {
        const props = volumeFixModalProps({
            resources: [{ id: 'vol-1', metadata: { workload: 'oracle' } }]
        });
        render(<SnapshotPolicyFixModal {...props} />);

        expect(screen.getByText(/Oracle databases/)).toBeInTheDocument();
    });
});
