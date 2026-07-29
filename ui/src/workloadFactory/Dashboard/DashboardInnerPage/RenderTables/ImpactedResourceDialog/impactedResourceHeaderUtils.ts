import { TFunction } from 'i18next';
import { getCardMetadata } from '../../../../../utils/configRegistry/configRegistryHelper';

const DEFAULT_IMPACTED_I18N_HEADER = 'databases.well-architect.dashboard-table-headers.impacted-resources';
export type ImpactedColumnHeader = {
    header: string;
    headerIsI18nKey: boolean;
};

/** cardMetadata.impactedLabel from config registry — same source as GetWell DynamicInnerTable. */
export const resolveImpactedColumnHeader = (configId: string, engineType: string): ImpactedColumnHeader => {
    const { impactedLabel } = getCardMetadata(configId, engineType);
    if (impactedLabel) {
        return { header: impactedLabel, headerIsI18nKey: false };
    }
    return { header: DEFAULT_IMPACTED_I18N_HEADER, headerIsI18nKey: true };
};

export const formatImpactedColumnHeader = ({ header, headerIsI18nKey }: ImpactedColumnHeader, t: TFunction): string =>
    headerIsI18nKey ? t(header) : header;
