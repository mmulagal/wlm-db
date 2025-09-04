import { useTranslation } from 'react-i18next';
import { DsButton } from '@tlveng/wlm-ds';
import { useDialog } from '@netapp/design-system';
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
            type === ASSESSMENT_CONFIG_NAMES.CONTROLFILES_PLACEMENT
        ) {
            dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE_INNER_PAGE));
            dispatch(setSelectedOptimizeConfig({ type, data: cardData, engineType: DBType.ORACLE }));
        } else {
            handleDialog(setDialog, cardData?.block_one?.value, () => {}, closeDialog, cardData, '', {}, DBType.ORACLE);
        }
    };

    return (
        <>
            {cardData?.block_one?.value !== 'ONTAP' && (
                <div className={styles.lastButton}>
                    <DsButton
                        variant="secondary"
                        isThin
                        isDisabled={loading || cardData?.block_two?.value !== GETWELL_STATUS.NOT_OPTIMIZED}
                        onClick={() => handleDifferentNavigation()}
                    >
                        {t('databases.oracle-inner-page.view')}
                    </DsButton>
                </div>
            )}
        </>
    );
};

export default ViewAndFixButton;
