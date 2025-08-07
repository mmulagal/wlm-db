import { DsRadioButton, DsTypography } from '@tlveng/wlm-ds';
import { t } from 'i18next';
import { useAppDispatch, useAppSelector } from '../../../store/storeHooks';
import { DBType } from '../../../utils/consts';
import { setSelectedHostType } from '../../../store/workloadFactory/inventoryV2Slice';
import styles from './EngineTypeSelector.module.scss';

const EngineTypeSelector = () => {
    const dispatch = useAppDispatch();
    const { selectedHostType } = useAppSelector(state => state.inventoryV2);
    return (
        <div className={styles['engine-type-selector']}>
            <DsTypography variant="Semibold_14">{t('databases.inventory.select-engine-type')}</DsTypography>
            <DsRadioButton
                id="select-mssql-engine-type"
                data-testid="wlm-db-mssql-engine-type-selector"
                variant="Default"
                title={t('databases.inventory.mssql')}
                isSelected={selectedHostType === DBType.MSSQL}
                onClick={() => {
                    dispatch(setSelectedHostType(DBType.MSSQL));
                }}
            />
            <DsRadioButton
                id="select-oracle-engine-type"
                data-testid="wlm-db-oracle-engine-type-selector"
                variant="Default"
                title={t('databases.inventory.oracle')}
                isSelected={selectedHostType === DBType.ORACLE}
                onClick={() => {
                    dispatch(setSelectedHostType(DBType.ORACLE));
                }}
            />
            <DsRadioButton
                id="select-postgresql-engine-type"
                data-testid="wlm-db-postgresql-engine-type-selector"
                variant="Default"
                title={t('databases.inventory.pgsql')}
                isSelected={selectedHostType === DBType.POSTGRESQL}
                onClick={() => {
                    dispatch(setSelectedHostType(DBType.POSTGRESQL));
                }}
            />
        </div>
    );
};

export default EngineTypeSelector;
