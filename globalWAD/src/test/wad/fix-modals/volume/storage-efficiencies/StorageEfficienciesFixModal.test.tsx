import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { StorageEfficienciesFixModal } from '@wad/fix-modals/volume/storage-efficiencies/StorageEfficienciesFixModal';
import { volumeFixModalProps } from '@test/helpers/testUtils';

describe('StorageEfficienciesFixModal', () => {
    it('calls fix with all resource ids when continue is clicked', () => {
        const props = volumeFixModalProps();
        render(<StorageEfficienciesFixModal {...props} />);

        fireEvent.click(screen.getByTestId('wlmdb-storage-efficiencies-fix-continue-btn'));

        expect(props.fix).toHaveBeenCalledWith(['vol-1'], {});
    });
});
