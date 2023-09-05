import { Button, Header, useDialog } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import { setSaveConfigName } from '../../../../store/mssql/mssqlFormSlice';
import { useSaveConfigDataMutation, useLazyGetConfigDataQuery } from '../../../../utils/apiService';
import { navigateToCanvas } from '../../../../utils/appConfig';
import { GENERAL, SELECT_CONFIG } from '../../../../utils/appConstants';
import { LoadConfiguration, SaveConfiguration } from '../../Configuration/LoadConfiguration';
import LoadConfig from '../../LoadConfig/LoadConfig';
import SaveConfig from '../../SaveConfig/SaveConfig';
import styles from './MSSqlHeader.module.scss';

const MSSqlHeader = () => {
    const { setDialog } = useDialog();
    const dispatch = useDispatch();

    const [saveConfigData] = useSaveConfigDataMutation();
    const [loadConfigDataExe] = useLazyGetConfigDataQuery();

    const handleLoadConfiguration = () => {
        setDialog(
            <DialogComponent
                header={GENERAL.LOAD_CONFIG_HEADER}
                content={<LoadConfig />}
                primaryButton={GENERAL.LOAD}
                secondaryButton={GENERAL.CANCEL}
                callback={() => LoadConfiguration(dispatch, loadConfigDataExe)}
                closeCallback={() => {}}
            />
        );
    };

    const handleSaveConfig = () => {
        setDialog(
            <DialogComponent
                header={GENERAL.SAVE_CONFIG_HEADER}
                content={<SaveConfig />}
                primaryButton={GENERAL.SAVE}
                secondaryButton={GENERAL.CANCEL}
                callback={() => SaveConfiguration(dispatch, saveConfigData)}
                closeCallback={() => dispatch(setSaveConfigName(''))}
            />
        );
    };
    return (
        <Header
            closeButtonProps={{
                onClick: function noRefCheck() {
                    navigateToCanvas();
                }
            }}
            title={SELECT_CONFIG.WIZARD_HEADING}
        >
            <div className={styles['header-button']}>
                <Button Component="button" onClick={handleLoadConfiguration} variant="text">
                    {SELECT_CONFIG.LOAD_CONFIG}
                </Button>
                <div className={styles.separator}></div>
                <Button Component="button" onClick={handleSaveConfig} variant="text">
                    {SELECT_CONFIG.SAVE_CONFIG}
                </Button>
            </div>
        </Header>
    );
};

export default MSSqlHeader;
