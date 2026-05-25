import { describe, it, expect, vi } from 'vitest';
import {
    LoadConfiguration,
    LoadRecommendedConfig,
    SaveConfiguration,
    duplicateSaveCheck,
    resetChecksAfterLoad,
    resetRefetchApiCheck
} from './LoadConfiguration';

const mockDispatch = vi.fn();
const mockLoadConfigDataExe = vi.fn();
const mockCloseDialog = vi.fn();
const mockSaveConfigData = vi.fn();

vi.mock('../../../store/store', () => ({
    default: {
        getState: () => ({
            mssqlForm: { loadConfig: 'config-123' },
            msSqlAction: {},
            chatbot: {}
        })
    }
}));

describe('LoadConfiguration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls loadConfigDataExe with correct config id', () => {
        mockLoadConfigDataExe.mockResolvedValue({ data: { data: {} } });
        LoadConfiguration(mockDispatch, mockLoadConfigDataExe, mockCloseDialog, 'config-123');
        expect(mockLoadConfigDataExe).toHaveBeenCalledWith({ configId: 'config-123' });
    });

    it('dispatches actions on successful load', async () => {
        const mockData = { data: { data: { region: 'us-east-1' } } };
        mockLoadConfigDataExe.mockResolvedValue(mockData);
        await LoadConfiguration(mockDispatch, mockLoadConfigDataExe, mockCloseDialog, 'config-123');
        expect(mockDispatch).toHaveBeenCalled();
    });

    it('handles load error', async () => {
        const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        mockLoadConfigDataExe.mockRejectedValue(new Error('Load failed'));
        await LoadConfiguration(mockDispatch, mockLoadConfigDataExe, mockCloseDialog, 'config-123');
        expect(mockDispatch).toHaveBeenCalled();
        consoleLogSpy.mockRestore();
    });

    it('uses config from store when not provided', () => {
        mockLoadConfigDataExe.mockResolvedValue({ data: { data: {} } });
        LoadConfiguration(mockDispatch, mockLoadConfigDataExe, mockCloseDialog);
        expect(mockLoadConfigDataExe).toHaveBeenCalledWith({ configId: 'config-123' });
    });
});

describe('LoadRecommendedConfig', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('dispatches form data when provided', () => {
        const mockFormData = { region: 'us-east-1' };
        LoadRecommendedConfig(mockDispatch, mockFormData);
        expect(mockDispatch).toHaveBeenCalled();
    });

    it('handles missing form data', () => {
        LoadRecommendedConfig(mockDispatch, null);
        expect(mockDispatch).toHaveBeenCalled();
    });

    it('skips notification when showNotification is false', () => {
        const mockFormData = { region: 'us-east-1' };
        LoadRecommendedConfig(mockDispatch, mockFormData, false);
        expect(mockDispatch).toHaveBeenCalled();
    });
});

describe('SaveConfiguration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls saveConfigData with form data', () => {
        const mockFormData = { region: 'us-east-1' };
        mockSaveConfigData.mockResolvedValue({ data: {} });
        SaveConfiguration(mockDispatch, mockSaveConfigData, mockFormData, mockCloseDialog, 'config-name');
        expect(mockSaveConfigData).toHaveBeenCalled();
    });

    it('handles save error', async () => {
        mockSaveConfigData.mockRejectedValue(new Error('Save failed'));
        await SaveConfiguration(mockDispatch, mockSaveConfigData, {}, mockCloseDialog, 'config-name');
        expect(mockDispatch).toHaveBeenCalled();
    });
});

describe('Utility functions', () => {
    it('resetChecksAfterLoad dispatches actions', () => {
        resetChecksAfterLoad(mockDispatch, mockCloseDialog);
        expect(mockDispatch).toHaveBeenCalled();
        expect(mockCloseDialog).toHaveBeenCalled();
    });

    it('resetRefetchApiCheck dispatches actions', () => {
        resetRefetchApiCheck(mockDispatch);
        expect(mockDispatch).toHaveBeenCalled();
    });
});

describe('duplicateSaveCheck - securityGroup comparison', () => {
    const baseConfig = (sgOverride: any) => ({
        securityGroup: { selectedExistingSecurityGroup: sgOverride }
    });

    it('returns true when both have same single SG (array format)', () => {
        const config = baseConfig([{ data: { id: 'sg-123' } }]);
        expect(duplicateSaveCheck(config, config)).toBe(true);
    });

    it('returns false when SGs differ', () => {
        const newConfig = baseConfig([{ data: { id: 'sg-123' } }]);
        const oldConfig = baseConfig([{ data: { id: 'sg-456' } }]);
        expect(duplicateSaveCheck(newConfig, oldConfig)).toBe(false);
    });

    it('returns true when both have same multiple SGs regardless of order', () => {
        const newConfig = baseConfig([{ data: { id: 'sg-1' } }, { data: { id: 'sg-2' } }]);
        const oldConfig = baseConfig([{ data: { id: 'sg-2' } }, { data: { id: 'sg-1' } }]);
        expect(duplicateSaveCheck(newConfig, oldConfig)).toBe(true);
    });

    it('returns false when SG count differs', () => {
        const newConfig = baseConfig([{ data: { id: 'sg-1' } }, { data: { id: 'sg-2' } }]);
        const oldConfig = baseConfig([{ data: { id: 'sg-1' } }]);
        expect(duplicateSaveCheck(newConfig, oldConfig)).toBe(false);
    });

    it('returns true when both have no SG selected', () => {
        const config = baseConfig(null);
        expect(duplicateSaveCheck(config, config)).toBe(true);
    });

    it('handles legacy single-object format without crashing', () => {
        const newConfig = baseConfig({ value: 'sg-123' });
        const oldConfig = baseConfig({ value: 'sg-123' });
        expect(duplicateSaveCheck(newConfig, oldConfig)).toBe(true);
    });

    it('returns false when oldConfig is null', () => {
        const newConfig = baseConfig([{ data: { id: 'sg-123' } }]);
        expect(duplicateSaveCheck(newConfig, null)).toBe(false);
    });
});
