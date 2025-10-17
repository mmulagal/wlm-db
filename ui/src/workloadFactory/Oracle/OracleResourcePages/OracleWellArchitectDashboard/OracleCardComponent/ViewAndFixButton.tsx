import { useTranslation } from 'react-i18next';
import { DsButton } from '@tlveng/wlm-ds';
import { DsPopover, useDialog } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import styles from './OracleCardComponent.module.scss';
import { ASSESSMENT_CONFIG_NAMES, DBType, GETWELL_STATUS, WLF_TABS } from '../../../../../utils/consts';
import { handleDialog } from '../../../../GetWell/StorageCardComponent/optimizeUtils';
import { setSelectedHeaderTab, setSelectedOptimizeConfig } from '../../../../../store/workloadFactory/inventoryV2Slice';

interface ViewAndFixButtonProps {
    cardData?: {
        block_one?: {
            value?: string;
        };
        block_two?: {
            value?: string;
        };
        mapName?: string;
        recommendedValue?: string;
    };
    loading?: boolean;
}

// For oracle assessment and optimization
const ViewAndFixButton = ({ cardData, loading }: ViewAndFixButtonProps) => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const { setDialog, closeDialog } = useDialog();

    const handleDifferentNavigation = () => {
        const type = cardData?.block_one?.value;
        if (
            type === ASSESSMENT_CONFIG_NAMES.REDO_LOGS_PLACEMENT ||
            type === ASSESSMENT_CONFIG_NAMES.ORACLE_BINARY_PLACEMENT ||
            type === ASSESSMENT_CONFIG_NAMES.ARCHIVE_PLACEMENT ||
            type === ASSESSMENT_CONFIG_NAMES.TEMP_LOGS_PLACEMENT ||
            type === ASSESSMENT_CONFIG_NAMES.DATAFILES_PLACEMENT ||
            type === ASSESSMENT_CONFIG_NAMES.CONTROLFILES_PLACEMENT ||
            type === ASSESSMENT_CONFIG_NAMES.DATA_DG_LUN_LAYOUT ||
            type === ASSESSMENT_CONFIG_NAMES.LOG_DG_LUN_LAYOUT ||
            type === ASSESSMENT_CONFIG_NAMES.FRA_DG_LUN_LAYOUT ||
            type === ASSESSMENT_CONFIG_NAMES.ARCHIVELOG_DG_LUN_LAYOUT
        ) {
            dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE_INNER_PAGE));
            dispatch(setSelectedOptimizeConfig({ type, data: cardData, engineType: DBType.ORACLE }));
        } else {
            handleDialog(setDialog, cardData?.block_one?.value, () => {}, closeDialog, cardData, '', {}, DBType.ORACLE);
        }
    };

    const viewButtonText = () => {
        const type = cardData?.block_one?.value;
        if (
            type === ASSESSMENT_CONFIG_NAMES.REDO_LOGS_PLACEMENT ||
            type === ASSESSMENT_CONFIG_NAMES.ORACLE_BINARY_PLACEMENT ||
            type === ASSESSMENT_CONFIG_NAMES.ARCHIVE_PLACEMENT ||
            type === ASSESSMENT_CONFIG_NAMES.TEMP_LOGS_PLACEMENT ||
            type === ASSESSMENT_CONFIG_NAMES.DATAFILES_PLACEMENT ||
            type === ASSESSMENT_CONFIG_NAMES.CONTROLFILES_PLACEMENT ||
            type === ASSESSMENT_CONFIG_NAMES.ASM_SETUP ||
            type === ASSESSMENT_CONFIG_NAMES.ASM_EXTERNAL_REDUNDANCY
        ) {
            return t('databases.oracle-inner-page.view');
        }
        if (
            type === ASSESSMENT_CONFIG_NAMES.DATA_DG_LUN_LAYOUT ||
            type === ASSESSMENT_CONFIG_NAMES.LOG_DG_LUN_LAYOUT ||
            type === ASSESSMENT_CONFIG_NAMES.FRA_DG_LUN_LAYOUT ||
            type === ASSESSMENT_CONFIG_NAMES.ARCHIVELOG_DG_LUN_LAYOUT
        ) {
            return t('databases.oracle-inner-page.view-and-fix');
        }
        return t('databases.oracle-inner-page.view');
    };

    const viewButtonDisable = () => {
        if (
            cardData?.mapName === ASSESSMENT_CONFIG_NAMES.CONTROLFILES_PLACEMENT &&
            cardData?.block_two?.value === GETWELL_STATUS.NOT_OPTIMIZED &&
            cardData?.recommendedValue === 'two-multiplexed-volumes'
        ) {
            return { isDisable: true, reason: t('databases.well-architect.controlfiles-view-disable') };
        }
        return { isDisable: loading || cardData?.block_two?.value !== GETWELL_STATUS.NOT_OPTIMIZED, reason: '' };
    };

    return (
        <>
            {cardData?.block_one?.value !== ASSESSMENT_CONFIG_NAMES.ONTAP_CAPS &&
                cardData?.block_one?.value !== ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM && (
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
                )}
        </>
    );
};

export default ViewAndFixButton;
