import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { ThinProvisioningFixModal } from '@wad/fix-modals/volume/thin-provisioning/ThinProvisioningFixModal';
import { volumeFixModalProps } from '@test/helpers/testUtils';

describe('ThinProvisioningFixModal', () => {
    it('calls fix with all resource ids when continue is clicked', async () => {
        const props = volumeFixModalProps();
        render(<ThinProvisioningFixModal {...props} />);

        fireEvent.click(screen.getByTestId('wlmdb-thin-provisioning-fix-continue-btn'));

        await waitFor(() => {
            expect(props.fix).toHaveBeenCalledWith(['vol-1'], {});
            expect(props.onFixSuccess).toHaveBeenCalledOnce();
            expect(props.close).toHaveBeenCalledOnce();
        });
    });
});
