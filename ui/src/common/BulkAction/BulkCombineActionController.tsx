import { DsButton, DsTypography } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import styles from './BulkActionContainer.module.scss';
import { CONFIG_STATE_ACTIONS } from '../../utils/consts';
import TooltipComponent from '../TooltipComponent/TooltipComponent';

type BulkActionContainerProps = {
    action: string;
    onClick: () => void;
    handleStateOperation: (actionType: string) => void;
    showDismissed?: boolean;
    isFixDisabled?: boolean;
    fixDisableMsg?: string;
    hideFixButton?: boolean;
};

const BulkCombineActionController = ({
    action,
    onClick,
    handleStateOperation,
    showDismissed,
    isFixDisabled,
    fixDisableMsg,
    hideFixButton = false
}: BulkActionContainerProps) => {
    const { t } = useTranslation();
    return (
        <div className={styles.bulkContainer}>
            <DsTypography variant="Semibold_14"> {t('databases.dismiss.bulk-actions')}</DsTypography>
            {!showDismissed && (
                <>
                    {!hideFixButton && (
                        <TooltipComponent title={fixDisableMsg} placement="bottom" width="260px" height="auto">
                            <div>
                                <DsButton type="text" onClick={onClick} isDisabled={isFixDisabled}>
                                    {action}
                                </DsButton>
                            </div>
                        </TooltipComponent>
                    )}
                    <DsButton type="text" onClick={() => handleStateOperation(CONFIG_STATE_ACTIONS.DISMISS)}>
                        {t('databases.dismiss.dismiss')}
                    </DsButton>
                    <DsButton type="text" onClick={() => handleStateOperation(CONFIG_STATE_ACTIONS.POSTPONED)}>
                        {t('databases.dismiss.postpone')}
                    </DsButton>
                </>
            )}
            {showDismissed && (
                <DsButton type="text" onClick={() => handleStateOperation(CONFIG_STATE_ACTIONS.ACTIVE)}>
                    {t('databases.dismiss.reactivate')}
                </DsButton>
            )}
        </div>
    );
};

export default BulkCombineActionController;
