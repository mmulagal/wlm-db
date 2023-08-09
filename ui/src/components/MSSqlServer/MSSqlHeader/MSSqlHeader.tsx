import { Button, Header, useDialog } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import { cmNavigateTo } from '../../../utils/appConfig';
import { GENERAL, SELECT_CONFIG } from '../../../utils/appConstants';
import { LoadConfiguration } from '../../Configuration/LoadConfiguration';
import LoadConfig from '../../LoadConfig/LoadConfig';
import styles from './MSSqlHeader.module.scss';

const MSSqlHeader = () => {
    const { setDialog } = useDialog();
    const dispatch = useDispatch();

    const handleLoadConfiguration = () => {
        setDialog(
            <DialogComponent
                header={GENERAL.LOAD_CONFIG_HEADER}
                content={<LoadConfig />}
                primaryButton={GENERAL.LOAD}
                secondaryButton={GENERAL.Cancel}
                callback={() => LoadConfiguration(dispatch)}
            />
        );
    };
    return (
        <Header
            closeButtonProps={{
                onClick: function noRefCheck() {cmNavigateTo('/')}
            }}
            title={SELECT_CONFIG.WIZARD_HEADING}
        >
            {/* <div className={styles['header-button']}>
                <Button Component="button" onClick={handleLoadConfiguration} variant="text">
                    {SELECT_CONFIG.LOAD_CONFIG}
                </Button>
                <div className={styles.separator}></div>
                <Button Component="button" onClick={function noRefCheck() {}} variant="text">
                    {SELECT_CONFIG.SAVE_CONFIG}
                </Button>
            </div> */}
        </Header>
    );
};

export default MSSqlHeader;
