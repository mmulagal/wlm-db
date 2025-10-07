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

const CalculatorMode = () => {
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

    return (
        <div className={styles.calcMode}>
            <DsTypography variant="Semibold_14">{t('databases.explore-savings.select-calculator-mode')}</DsTypography>

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
        </div>
    );
};

export default CalculatorMode;
