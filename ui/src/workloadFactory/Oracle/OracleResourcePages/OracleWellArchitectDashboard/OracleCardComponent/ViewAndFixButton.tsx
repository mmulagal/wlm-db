import { useTranslation } from 'react-i18next';
import { DsButton } from '@tlveng/wlm-ds';
import { DsPopover, useDialog } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import styles from './OracleCardComponent.module.scss';
import {
    ACTION_CTA,
    ASSESSMENT_CONFIG_IDS,
    CONFIG_STATES,
    DBType,
    GETWELL_STATUS,
    WLF_TABS
} from '../../../../../utils/consts';
import { handleDialog } from '../../../../GetWell/StorageCardComponent/optimizeUtils';
import { setSelectedHeaderTab, setSelectedOptimizeConfig } from '../../../../../store/workloadFactory/inventoryV2Slice';
import { hasInnerPage, getButtonText as getButtonTextFromRegistry } from '../../../../../utils/configRegistry';

interface ViewAndFixButtonProps {
    cardData?: {
        id?: string; // Flat API format
        status?: string; // Flat API format
        block_one?: {
            value?: string;
        };
        block_two?: {
            value?: string;
        };
        mapName?: string;
        recommendedValue?: string;
        dismissedObj?: {
            configState?: string;
        };
    };
    loading?: boolean;
    callOptimizeApi?: (type: string) => void;
    isWad?: boolean;
}

// For oracle assessment and optimization
const ViewAndFixButton = ({ cardData, loading, callOptimizeApi, isWad = false }: ViewAndFixButtonProps) => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const { setDialog, closeDialog } = useDialog();

    // Get config ID from flat API format (cardData.id) or fallback to legacy format (block_one.value)
    const configId = cardData?.id || cardData?.block_one?.value || '';
    // Use block_two.value (transformed status with capital letters) or fallback to cardData.status for optimization states
    const status = cardData?.block_two?.value || cardData?.status;

    const handleDifferentNavigation = () => {
        // Use registry-based routing: check if this config has an inner page
        if (configId && hasInnerPage(configId, DBType.ORACLE)) {
            dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE_INNER_PAGE));
            // cardData now has both API fields (name, categories) and legacy fields (mapName, tags)
            dispatch(
                setSelectedOptimizeConfig({
                    type: configId,
                    data: cardData,
                    engineType: DBType.ORACLE
                })
            );
        } else {
            // Open dialog for configs without inner pages
            handleDialog(setDialog, configId, callOptimizeApi, closeDialog, cardData, '', {}, DBType.ORACLE, isWad);
        }
    };

    const viewButtonText = () => {
        // Guard against empty configId
        if (!configId) {
            return t('databases.oracle-inner-page.view');
        }

        // Use registry-based button text
        const buttonText = getButtonTextFromRegistry(configId, DBType.ORACLE, status);

        // Translate based on button text
        if (buttonText === ACTION_CTA.FIX_ISSUES) {
            return t('databases.oracle-inner-page.view-and-fix');
        }

        return t('databases.oracle-inner-page.view');
    };

    const viewButtonDisable = () => {
        const type = configId;

        // Check if card is in ACTIVATING state - disable button if true
        if (cardData?.dismissedObj?.configState === CONFIG_STATES.ACTIVATING) {
            return { isDisable: true, reason: '' };
        }

        if (isWad && type === ASSESSMENT_CONFIG_IDS.CLONE_MANAGEMENT) {
            return {
                isDisable: true,
                reason: t('databases.wad.tab-disabled-message-oracle')
            };
        }

        if (type === ASSESSMENT_CONFIG_IDS.FILE_SYSTEM_HEADROOM) {
            // Enable for File system headroom when status is under-provisioned, not-optimized, or over-provisioned
            const enabledStatuses = [
                GETWELL_STATUS.UNDER_PROVISIONED,
                GETWELL_STATUS.NOT_OPTIMIZED,
                GETWELL_STATUS.OVER_PROVISIONED
            ];
            return { isDisable: loading || !status || !enabledStatuses.includes(status), reason: '' };
        }

        return { isDisable: loading || status !== GETWELL_STATUS.NOT_OPTIMIZED, reason: '' };
    };

    return (
        <div className={styles.lastButton}>
            <DsPopover trigger="hover" title={viewButtonDisable().reason} placement="left">
                <DsButton
                    variant="secondary"
                    isThin
                    isDisabled={viewButtonDisable().isDisable}
                    onClick={() => handleDifferentNavigation()}
                >
                    {viewButtonText()}
                </DsButton>
            </DsPopover>
        </div>
    );
};

export default ViewAndFixButton;
