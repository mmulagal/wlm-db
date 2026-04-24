import { DsRadioButton, DsTypography } from '@tlveng/wlm-ds';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';
import styles from './CalculatorMode.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import {
    setSelectedCalculatorMode,
    setStorageSavingsResponse,
    setViewCalculationsResponse
} from '../../../../store/workloadFactory/exploreSavingsSlice';
import { TCO_CALCULATOR_MODE } from '../../../../utils/consts';

interface CalculatorModeProps {
    printState?: boolean;
}

const CalculatorMode = ({ printState = false }: CalculatorModeProps) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const {
        selectedCalculatorMode,
        optimizedStorageSavingsResponse,
        standardStorageSavingsResponse,
        optimizedViewCalculationsResponse,
        standardViewCalculationsResponse
    } = useAppSelector(state => state.exploreSavings);

    const handleOptimizedClick = useCallback(
        (e: React.SyntheticEvent) => {
            e.preventDefault();
            e.stopPropagation();

            dispatch(setStorageSavingsResponse(optimizedStorageSavingsResponse));
            dispatch(setViewCalculationsResponse(optimizedViewCalculationsResponse));
            dispatch(setSelectedCalculatorMode(TCO_CALCULATOR_MODE.OPTIMIZED));
        },
        [dispatch, optimizedStorageSavingsResponse, optimizedViewCalculationsResponse]
    );

    const handleStandardClick = useCallback(
        (e: React.SyntheticEvent) => {
            e.preventDefault();
            e.stopPropagation();

            dispatch(setStorageSavingsResponse(standardStorageSavingsResponse));
            dispatch(setViewCalculationsResponse(standardViewCalculationsResponse));
            dispatch(setSelectedCalculatorMode(TCO_CALCULATOR_MODE.STANDARD));
        },
        [dispatch, standardStorageSavingsResponse, standardViewCalculationsResponse]
    );

    const isOptimized = selectedCalculatorMode === TCO_CALCULATOR_MODE.OPTIMIZED;

    return (
        <div className={styles.calcMode}>
            <DsTypography variant="Semibold_14">{t('databases.explore-savings.select-calculator-mode')}</DsTypography>

            {printState ? (
                <div className={styles.radioContainer}>
                    <div className={styles.staticRadio}>
                        <span className={styles.radioIcon}>{isOptimized ? '\u25C9' : '\u25CB'}</span>
                        <DsTypography variant="Regular_14">
                            {t('databases.explore-savings.optimized-based-on-usage')}
                        </DsTypography>
                    </div>
                    <div className={styles.staticRadio}>
                        <span className={styles.radioIcon}>{!isOptimized ? '\u25C9' : '\u25CB'}</span>
                        <DsTypography variant="Regular_14">{t('databases.explore-savings.standard')}</DsTypography>
                    </div>
                </div>
            ) : (
                <div className={styles.radioContainer}>
                    <DsRadioButton
                        id="select-optimized-type"
                        data-testid="wlm-db-es-select-optimized-type"
                        variant="Default"
                        title={t('databases.explore-savings.optimized-based-on-usage')}
                        isSelected={selectedCalculatorMode === TCO_CALCULATOR_MODE.OPTIMIZED}
                        onClick={handleOptimizedClick}
                    />

                    <DsRadioButton
                        id="select-standard-type"
                        data-testid="wlm-db-es-select-standard-type"
                        variant="Default"
                        title={t('databases.explore-savings.standard')}
                        isSelected={selectedCalculatorMode === TCO_CALCULATOR_MODE.STANDARD}
                        onClick={handleStandardClick}
                    />
                </div>
            )}
        </div>
    );
};

export default CalculatorMode;
