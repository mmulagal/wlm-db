import { Button, Header, useDialog } from '@netapp/design-system';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import { setSaveConfigName } from '../../../../store/mssql/mssqlFormSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import { useSaveConfigDataMutation, useLazyGetConfigDataQuery, useGetConfigListQuery } from '../../../../utils/apiService';
import { GENERAL, SELECT_CONFIG } from '../../../../utils/appConstants';
import { FROM_DIALOG } from '../../../../utils/consts';
import { LoadConfiguration, resetChecksAfterLoad, SaveConfiguration } from '../../Configuration/LoadConfiguration';
import LoadConfig from '../../LoadConfig/LoadConfig';
import SaveConfig from '../../SaveConfig/SaveConfig';
import styles from './MSSqlHeader.module.scss';

const MSSqlHeader = () => {
    const { setDialog, closeDialog } = useDialog();
    const dispatch = useDispatch();

    const { configData} = useAppSelector(state => state.mssql.getSavedConfigList);

    const [saveConfigData] = useSaveConfigDataMutation();
    const [loadConfigDataExe] = useLazyGetConfigDataQuery();
    
    // API call to get configuration list
    const {
        refetch: configListRefetch
    } = useGetConfigListQuery({});

    const isLoadConfig = useAppSelector(state => state.msSqlAction.isLoadConfig);
    const isMissing = useAppSelector(state => state.msSqlAction.isMissingFieldsInLoad);
    const refetchApiCount = useAppSelector(state => state.msSqlAction.refetchApiCount);
    
    useEffect(() => {
        if(isLoadConfig){
            if(refetchApiCount?.isLoading && ( refetchApiCount?.expected === 0 || 
                refetchApiCount?.ran === refetchApiCount?.expected)) {
                resetChecksAfterLoad(dispatch, closeDialog , isMissing);
            } 
        } 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoadConfig, refetchApiCount])

    const handleLoadConfiguration = () => {
        setDialog(
            <DialogComponent
                header={GENERAL.LOAD_CONFIG_HEADER}
                content={<LoadConfig />}
                primaryButton={GENERAL.LOAD}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    LoadConfiguration(dispatch, loadConfigDataExe, closeDialog);
                }}
                closeCallback={() => {}}
                dialogFrom={FROM_DIALOG.LOAD_CONFIG}
            />
        );
    };

    const handleSaveConfig = (dialogFrom: string) => {
        setDialog(
            <DialogComponent
                header={GENERAL.SAVE_CONFIG_HEADER}
                content={<SaveConfig />}
                primaryButton={GENERAL.SAVE}
                secondaryButton={GENERAL.CANCEL}
                callback={() => SaveConfiguration(dispatch, saveConfigData, configListRefetch, closeDialog)}
                closeCallback={() => dispatch(setSaveConfigName(''))}
                dialogFrom={dialogFrom}
            />
        );
    };

    return (
        <Header
            closeButtonProps={{
                onClick: () => handleSaveConfig(FROM_DIALOG.HEADER_CROSS)
            }}
            title={SELECT_CONFIG.WIZARD_HEADING}
        >
            <div className={styles['header-button']}>
                <Button Component="button" onClick={handleLoadConfiguration} variant="text" 
                    isDisabled={!configData} title={!configData ? SELECT_CONFIG.NO_SAVED_CONFIG: ''}>
                    {SELECT_CONFIG.LOAD_CONFIG}
                </Button>
                <div className={styles.separator}></div>
                <Button Component="button" onClick={() => handleSaveConfig(FROM_DIALOG.SAVE_CONFIG)} variant="text">
                    {SELECT_CONFIG.SAVE_CONFIG}
                </Button>
            </div>
        </Header>
    );
};

export default MSSqlHeader;
