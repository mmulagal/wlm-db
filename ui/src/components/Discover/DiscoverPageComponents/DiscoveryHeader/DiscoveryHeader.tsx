import { Button, Header, useDialog } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import { navigateToCanvas } from '../../../../utils/appConfig';
import { GENERAL, SELECT_CONFIG } from '../../../../utils/appConstants';
import styles from './MSSqlHeader.module.scss';

const DiscoveryHeader = () => {
    const { setDialog } = useDialog();
    const dispatch = useDispatch();

    return (
        <Header
            closeButtonProps={{
                onClick: function noRefCheck() {
                    navigateToCanvas('/');
                }
            }}
            title={SELECT_CONFIG.DISCOVER_SQL_SERVER}
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

export default DiscoveryHeader;
