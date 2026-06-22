/**
 * DialogContent - Thin wrapper around DynamicDialogContent
 *
 * Previously this file contained 1400+ lines of switch-case logic routing to different
 * dialog components. Now it just passes props to DynamicDialogContent which handles ALL
 * configs dynamically via DIALOG_CONTENT_MAP in the registry.
 */

import { DsTypography } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import styles from './DialogContent.module.scss';
import {
    DBType,
    GETWELL_STATUS,
    MSSQL_UNSUPPORTED_FIX_TYPES,
    ORACLE_UNSUPPORTED_FIX_TYPES,
    OVER_PROVISIONED_UNSUPPORTED_FIX_TYPES,
    UNDER_PROVISIONED_UNSUPPORTED_FIX_TYPES,
    ASSESSMENT_CONFIG_NAMES
} from '../../../../utils/consts';
import DynamicDialogContent from './DynamicDialogContent';
import { ReactComponent as InfoIcon } from '../../../../assets/info.svg';

interface SavingsOpportunity {
    savingsOpportunityPercentage?: number;
}

interface RecommendationOption {
    instanceType?: string;
    rank?: number;
    savingsOpportunity?: SavingsOpportunity;
    [key: string]: unknown;
}

interface BulkRecommendationOption {
    hostName?: string;
    recommendationOptions?: RecommendationOption[];
    missingPermissions?: boolean;
    [key: string]: unknown;
}

type DialogType = {
    type: string;
    recommendationOptions?: RecommendationOption[];
    missingPermissions?: string[];
    recommendedSizeInGib?: number;
    bulkRecommendationOptions?: BulkRecommendationOption[];
    operation?: string;
    objectsInViolation?: string[];
    engineType?: string;
    assessmentStatus?: boolean;
    status?: string;
    isWad?: boolean;
};

type BannerConfig = { key: string; params?: Record<string, string> };

const shouldShowUnsupportedFixBanner = (
    type: string,
    engineType: string,
    isWad: boolean,
    status?: string,
    missingPermissions?: string[]
): BannerConfig | '' => {
    const isOracle = engineType === DBType.ORACLE;
    const wadKey = isOracle ? 'databases.wad.tab-disabled-message-oracle' : 'databases.wad.tab-disabled-message';
    const isOverProvisioned =
        OVER_PROVISIONED_UNSUPPORTED_FIX_TYPES.has(type) && status === GETWELL_STATUS.OVER_PROVISIONED;
    const isUnderProvisionedWithMissingPerms =
        UNDER_PROVISIONED_UNSUPPORTED_FIX_TYPES.has(type) &&
        status === GETWELL_STATUS.UNDER_PROVISIONED &&
        !!missingPermissions?.length;
    const unsupportedFixSet = isOracle ? ORACLE_UNSUPPORTED_FIX_TYPES : MSSQL_UNSUPPORTED_FIX_TYPES;

    const configNameLower = type.toLowerCase();

    const rules: [boolean, BannerConfig][] = [
        [isWad, { key: wadKey }],
        [
            isOverProvisioned,
            { key: 'databases.well-architect.over-provisioned-fix-disabled', params: { configName: configNameLower } }
        ],
        [
            isUnderProvisionedWithMissingPerms && type === ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE,
            { key: 'databases.well-architect.tempdb-drive-under-provisioned-missing-permissions-error' }
        ],
        [
            isUnderProvisionedWithMissingPerms,
            {
                key: 'databases.well-architect.under-provisioned-missing-permissions-fix-disabled',
                params: { configName: configNameLower }
            }
        ],
        [unsupportedFixSet.has(type), { key: 'databases.well-architect.fix-disabled' }]
    ];
    return rules.find(([condition]) => condition)?.[1] ?? '';
};

const DialogContent = ({
    type,
    recommendationOptions = [],
    missingPermissions,
    recommendedSizeInGib,
    bulkRecommendationOptions = [],
    operation = 'single',
    objectsInViolation = [],
    engineType = DBType.MSSQL,
    assessmentStatus = false,
    status,
    isWad = false
}: DialogType) => {
    const { t } = useTranslation();

    const showUnsupportedFixBanner = shouldShowUnsupportedFixBanner(
        type,
        engineType,
        isWad,
        status,
        missingPermissions
    );

    return (
        <div className={styles.dialogContent}>
            {showUnsupportedFixBanner && (
                <div className={styles.unsupportedFixBanner}>
                    <InfoIcon />
                    <DsTypography variant="Regular_14">
                        {t(showUnsupportedFixBanner.key, showUnsupportedFixBanner.params)}
                    </DsTypography>
                </div>
            )}
            <DynamicDialogContent
                configId={type}
                engineType={engineType}
                isWad={isWad}
                assessmentStatus={assessmentStatus}
                status={status}
                missingPermissions={missingPermissions}
                objectsInViolation={objectsInViolation}
                recommendationOptions={recommendationOptions}
                bulkRecommendationOptions={bulkRecommendationOptions}
                operation={operation}
                recommendedSizeInGib={recommendedSizeInGib}
            />
        </div>
    );
};

export default DialogContent;
