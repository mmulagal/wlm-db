import { useTranslation } from 'react-i18next';
import { DsButton } from '@tlveng/wlm-ds';
import { useDialog } from '@netapp/design-system';
import styles from './OracleCardComponent.module.scss';
import { DBType, GETWELL_STATUS } from '../../../../../utils/consts';
import { handleDialog } from '../../../../GetWell/StorageCardComponent/optimizeUtils';

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

const ViewAndFixButton = ({ cardData, loading }: ViewAndFixButtonProps) => {
    const { t } = useTranslation();
    const { setDialog, closeDialog } = useDialog();

    const handleDifferentNavigation = () => {
        handleDialog(setDialog, cardData?.block_one?.value, () => {}, closeDialog, cardData, '', {}, DBType.ORACLE);
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
