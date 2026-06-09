import { DsRadioButton, DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../../../store/storeHooks';
import { DBType } from '../../../../utils/consts';
import { setSelectedEngineTypeForWADDashboard } from '../../../../store/workloadFactory/inventoryV2Slice';
import styles from '../../../../common/EngineTypeSelector/EngineTypeSelector.module.scss';

type WADEngineTypeSelectorProps = {
    showLabel?: boolean;
    className?: string;
};

const WADEngineTypeSelector = ({ showLabel = true, className }: WADEngineTypeSelectorProps) => {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const { selectedEngineTypeForWADDashboard } = useAppSelector(state => state.inventoryV2);

    return (
        <div className={`${styles['engine-type-selector']} ${className ?? ''}`}>
            {showLabel && (
                <DsTypography variant="Semibold_14">{t('databases.inventory.select-engine-type')}</DsTypography>
            )}
            <DsRadioButton
                id="wad-dashboard-mssql-engine-type"
                data-testid="wlm-db-wad-dashboard-mssql-engine-type-selector"
                variant="Default"
                title={t('databases.inventory.mssql')}
                isSelected={selectedEngineTypeForWADDashboard === DBType.MSSQL}
                onClick={() => {
                    dispatch(setSelectedEngineTypeForWADDashboard(DBType.MSSQL));
                }}
            />
            <DsRadioButton
                id="wad-dashboard-oracle-engine-type"
                data-testid="wlm-db-wad-dashboard-oracle-engine-type-selector"
                variant="Default"
                title={t('databases.inventory.oracle')}
                isSelected={selectedEngineTypeForWADDashboard === DBType.ORACLE}
                onClick={() => {
                    dispatch(setSelectedEngineTypeForWADDashboard(DBType.ORACLE));
                }}
            />
        </div>
    );
};

export default WADEngineTypeSelector;
