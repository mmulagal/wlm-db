import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { DsTypography } from '@tlveng/wlm-ds';
import { DsButton } from '@netapp/design-system';
import styles from './OptimizedModel.module.scss';
import { ReactComponent as OptimizeImage } from '../../../../assets/optimizeES.svg';
import {
    setOptimizeLink,
    setShowOptimizeMode,
    setStorageSavingsResponse,
    setViewCalculationsResponse,
    setSelectedCalculatorMode
} from '../../../../store/workloadFactory/exploreSavingsSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import { TCO_CALCULATOR_MODE } from '../../../../utils/consts';

const OptimizedModel = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { showOptimizeMode, standardStorageSavingsResponse, standardViewCalculationsResponse } = useAppSelector(
        state => state.exploreSavings
    );

    const handleOptimizeButton = () => {
        // As data is loaded in same api so no need to loading true
        // dispatch(setShowOptimizeMode({ optimizeLoading: true, showCalcMode: false }));
        dispatch(setShowOptimizeMode({ optimizeLoading: false, showCalcMode: true }));
        dispatch(setOptimizeLink(false));
    };

    const handleStandardButton = () => {
        // Set standard mode data on maybe later click
        dispatch(setStorageSavingsResponse(standardStorageSavingsResponse));
        dispatch(setViewCalculationsResponse(standardViewCalculationsResponse));
        dispatch(setSelectedCalculatorMode(TCO_CALCULATOR_MODE.STANDARD));
        dispatch(setOptimizeLink(true));
    };

    return (
        <div className={styles.optimizedModel}>
            <div className={styles.overlay}>
                <div className={styles.modal}>
                    <div className={styles.header}>
                        <OptimizeImage />
                    </div>
                    <div className={styles.content}>
                        <DsTypography variant="Semibold_16">
                            {t('databases.explore-savings.optimize-dialog-title')}
                        </DsTypography>
                        <DsTypography variant="Regular_14" className={styles.description}>
                            {t('databases.explore-savings.optimize-dialog-description')}
                        </DsTypography>

                        <div className={styles.footer}>
                            <DsButton
                                type="text"
                                onClick={() => {
                                    handleStandardButton();
                                }}
                            >
                                {t('databases.explore-savings.maybe-later')}
                            </DsButton>
                            <DsButton
                                variant="primary"
                                isThin
                                isLoading={showOptimizeMode?.optimizeLoading}
                                onClick={() => {
                                    handleOptimizeButton();
                                }}
                            >
                                {t('databases.explore-savings.optimize-savings')}
                            </DsButton>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OptimizedModel;
