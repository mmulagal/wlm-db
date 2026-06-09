import { DsRadioButton, DsSingleFileUpload, DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../../../store/storeHooks';
import { DBType } from '../../../../utils/consts';
import { setSelectedEngineTypeForWADDashboard } from '../../../../store/workloadFactory/inventoryV2Slice';
import styles from '../../../../common/EngineTypeSelector/EngineTypeSelector.module.scss';
import selectorStyles from './WADEngineTypeSelector.module.scss';

type WADEngineTypeSelectorContext = 'learn' | 'download' | 'upload';

type WADEngineTypeSelectorProps = {
    context?: WADEngineTypeSelectorContext;
    className?: string;
    onFileChange?: (file: File | null) => void;
};

const WADEngineTypeSelector = ({ context = 'learn', className, onFileChange }: WADEngineTypeSelectorProps) => {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const { selectedEngineTypeForWADDashboard } = useAppSelector(state => state.inventoryV2);

    const descriptionText =
        context === 'download'
            ? t('databases.inventory.select-engine-type-for-download')
            : context === 'upload'
              ? t('databases.inventory.select-engine-type-for-upload')
              : null;

    return (
        <div className={selectorStyles.wadEngineTypeSelector}>
            {descriptionText && (
                <DsTypography variant="Regular_14">{descriptionText}</DsTypography>
            )}
            <div className={`${styles['engine-type-selector-dialog']} ${className ?? ''}`}>                
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
            {context === 'upload' && (
                <DsSingleFileUpload
                    style={{marginTop: '10px'}}
                    title={t('databases.inventory.wad-upload-file-label')}
                    placeholder={t('databases.inventory.wad-upload-file-placeholder')}                    
                    acceptableTypes={['.json']}
                    data-testid="wlm-db-wad-upload-file-uploader"
                    onChange={uploadedFile => {
                        const file = uploadedFile?.data?.get('file') as File | undefined;
                        onFileChange?.(file ?? null);
                    }}
                />
            )}
        </div>
    );
};

export default WADEngineTypeSelector;
