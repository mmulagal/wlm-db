import { describe, it, expect, vi } from 'vitest';
import { getOptimizationStatusData } from './InventoryUtilsV2';
import { GENERAL } from '../../utils/appConstants';
import { INVENTORY_STATUS } from '../../utils/consts';

vi.mock('../../store/store', () => ({
    default: {
        getState: vi.fn(() => ({
            headers: { credentialMapping: {}, regionMapping: {} },
            inventoryV2: { removeSecNodeDiscoveredList: [] }
        }))
    }
}));

vi.mock('../../assets/tooltipGrey.svg', () => ({ ReactComponent: () => null }));
vi.mock('../../assets/ic_copy.svg', () => ({ ReactComponent: () => null }));
vi.mock('../GetWell/GetWellUtils', () => ({
    formatOptimizationBreakDown: vi.fn(),
    getCardsData: vi.fn(),
    cardDataDefault: {}
}));
vi.mock('./InventoryTablesComponent/ManageInstanceWizard/DetectInstanceStep/DetectContent/DetectContentHelper', () => ({
    isAuthRequiredForInstance: vi.fn()
}));

describe('getOptimizationStatusData', () => {
    const t = (key: string) => key;

    it('returns unregistered assessment status instead of Not analyzed for unmanaged FSxN hosts', () => {
        const row = {
            isUnregistered: true,
            isWad: false,
            optimizationStatus: '3 issues',
            statusColText: INVENTORY_STATUS.UNMANAGED,
            fileSystemType: GENERAL.FSX_FOR_ONTAP
        };

        expect(getOptimizationStatusData(row, t)).toEqual({
            displayValue: '3 issues',
            disableMsg: '',
            isDisabled: false
        });
    });
});
