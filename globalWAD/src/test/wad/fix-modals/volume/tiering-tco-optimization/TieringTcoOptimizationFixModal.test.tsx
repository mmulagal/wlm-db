import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { TieringTcoOptimizationFixModal } from '@wad/fix-modals/volume/tiering-tco-optimization/TieringTcoOptimizationFixModal';
import { volumeFixModalProps } from '@test/helpers/testUtils';

describe('TieringTcoOptimizationFixModal', () => {
    it('calls fix with all resource ids when continue is clicked', () => {
        const props = volumeFixModalProps();
        render(<TieringTcoOptimizationFixModal {...props} />);

        fireEvent.click(screen.getByTestId('wlmdb-tiering-tco-optimization-fix-continue-btn'));

        expect(props.fix).toHaveBeenCalledWith(['vol-1'], {});
    });
});
