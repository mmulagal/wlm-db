import { useTranslation } from 'react-i18next';
import { DsButton } from '@tlveng/wlm-ds';
import { DsPopover, useDialog } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import styles from './OracleCardComponent.module.scss';
import { ASSESSMENT_CONFIG_NAMES, CONFIG_STATES, DBType, GETWELL_STATUS, WLF_TABS } from '../../../../../utils/consts';
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
            type === ASSESSMENT_CONFIG_NAMES.ARCHIVELOG_DG_LUN_LAYOUT ||
            type === ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_DATABASEFILES ||
            type === ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_ADRHOME ||
            type === ASSESSMENT_CONFIG_NAMES.NFS_CACHING_OPTIONS ||
            type === ASSESSMENT_CONFIG_NAMES.CRR ||
            type === ASSESSMENT_CONFIG_NAMES.SNAPCENTER_SNAPSHOT ||
            type === ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT
        ) {
            dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE_INNER_PAGE));
            dispatch(setSelectedOptimizeConfig({ type, data: cardData, engineType: DBType.ORACLE }));
        } else {
            handleDialog(
                setDialog,
                cardData?.block_one?.value,
                callOptimizeApi,
                closeDialog,
                cardData,
                '',
                {},
                DBType.ORACLE,
                isWad
            );
        }
    };

    const viewButtonText = () => {
        const type = cardData?.block_one?.value;
        const status = cardData?.block_two?.value;

        if (
            type === ASSESSMENT_CONFIG_NAMES.REDO_LOGS_PLACEMENT ||
            type === ASSESSMENT_CONFIG_NAMES.ORACLE_BINARY_PLACEMENT ||
            type === ASSESSMENT_CONFIG_NAMES.ARCHIVE_PLACEMENT ||
            type === ASSESSMENT_CONFIG_NAMES.TEMP_LOGS_PLACEMENT ||
            type === ASSESSMENT_CONFIG_NAMES.DATAFILES_PLACEMENT ||
            type === ASSESSMENT_CONFIG_NAMES.CONTROLFILES_PLACEMENT ||
            type === ASSESSMENT_CONFIG_NAMES.ASM_SETUP ||
            type === ASSESSMENT_CONFIG_NAMES.ASM_EXTERNAL_REDUNDANCY ||
            type === ASSESSMENT_CONFIG_NAMES.ASMLIB_LOGICAL_BLOCK_SIZE ||
            type === ASSESSMENT_CONFIG_NAMES.AFD_LOGICAL_BLOCK_SIZE ||
            type === ASSESSMENT_CONFIG_NAMES.CRR ||
            type === ASSESSMENT_CONFIG_NAMES.SNAPCENTER_SNAPSHOT ||
            (type === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM && status === GETWELL_STATUS.OVER_PROVISIONED)
        ) {
            return t('databases.oracle-inner-page.view');
        }
        if (type === ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT) {
            return t('databases.oracle-inner-page.view-and-fix');
        }
        if (
            type === ASSESSMENT_CONFIG_NAMES.DATA_DG_LUN_LAYOUT ||
            type === ASSESSMENT_CONFIG_NAMES.LOG_DG_LUN_LAYOUT ||
            type === ASSESSMENT_CONFIG_NAMES.FRA_DG_LUN_LAYOUT ||
            type === ASSESSMENT_CONFIG_NAMES.ARCHIVELOG_DG_LUN_LAYOUT ||
            type === ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS ||
            type === ASSESSMENT_CONFIG_NAMES.TRANSPARENT_HUGEPAGES ||
            type === ASSESSMENT_CONFIG_NAMES.TCP_ADVANCED_OPTIONS ||
            type === ASSESSMENT_CONFIG_NAMES.MULTIPATH_READCOUNT ||
            (type === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM && status === GETWELL_STATUS.UNDER_PROVISIONED)
        ) {
            return t('databases.oracle-inner-page.view-and-fix');
        }
        return t('databases.oracle-inner-page.view');
    };

    const viewButtonDisable = () => {
        const type = cardData?.block_one?.value;
        const status = cardData?.block_two?.value;

        // Check if card is in ACTIVATING state - disable button if true
        if (cardData?.dismissedObj?.configState === CONFIG_STATES.ACTIVATING) {
            return { isDisable: true, reason: '' };
        }

        if (isWad && type === ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT) {
            return {
                isDisable: true,
                reason: t('databases.wad.tab-disabled-message-oracle')
            };
        }

        if (type === ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM) {
            // Enable for File system headroom when status is under-provisioned or over-provisioned
            const enabledStatuses = [GETWELL_STATUS.UNDER_PROVISIONED, GETWELL_STATUS.OVER_PROVISIONED];
            return { isDisable: loading || !status || !enabledStatuses.includes(status), reason: '' };
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
