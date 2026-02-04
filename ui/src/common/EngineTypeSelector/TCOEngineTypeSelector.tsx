import { DsRadioButton, DsTypography } from '@tlveng/wlm-ds';
import { t } from 'i18next';

import styles from './EngineTypeSelector.module.scss';
import { useAppDispatch, useAppSelector } from '../../store/storeHooks';
import { DBType } from '../../utils/consts';
import { setSelectedTCOHostType } from '../../store/workloadFactory/exploreSavingsSlice';

const TCOEngineTypeSelector = () => {
    const dispatch = useAppDispatch();
    const { selectedTCOHostType } = useAppSelector(state => state.exploreSavings);
    return (
        <div className={styles['engine-type-selector']}>
            <DsTypography variant="Semibold_14">{t('databases.inventory.select-engine-type')}</DsTypography>
            <DsRadioButton
                id="select-mssql-engine-type"
                data-testid="wlm-db-mssql-engine-type-selector"
                variant="Default"
                title={t('databases.inventory.mssql')}
                isSelected={selectedTCOHostType === DBType.MSSQL}
                onClick={() => {
                    dispatch(setSelectedTCOHostType(DBType.MSSQL));
                }}
            />
            <DsRadioButton
                id="select-oracle-engine-type"
                data-testid="wlm-db-oracle-engine-type-selector"
                variant="Default"
                title={t('databases.inventory.oracle')}
                isSelected={selectedTCOHostType === DBType.ORACLE}
                onClick={() => {
                    dispatch(setSelectedTCOHostType(DBType.ORACLE));
                }}
            />
        </div>
    );
};

export default TCOEngineTypeSelector;
