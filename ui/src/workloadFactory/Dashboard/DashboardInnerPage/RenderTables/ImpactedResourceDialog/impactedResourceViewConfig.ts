import { getConfigEntry } from '../../../../../utils/configRegistry/configRegistryHelper';

/** Whether the Fix table should show View for this config. Driven by the viewLink flag in the config registry. */
// eslint-disable-next-line import/prefer-default-export
export const isFixTableImpactedViewSupported = (configId: string, engineType?: string): boolean => {
    if (!configId || !engineType) {
        return false;
    }
    return getConfigEntry(configId, engineType)?.viewLink ?? false;
};
