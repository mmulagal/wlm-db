import { DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import styles from './ProtectionDialogs.module.scss';

const FetchingDialog = () => (
        <div className={styles.loadingDialog}>
            <DsFlashingDotsLoader />
            <DsTypography
                variant="Regular_14"
                style={{ width: '277px', display: 'flex', justifyContent: 'center', marginTop: '8px' }}
            >
                Fetching data
            </DsTypography>
            <DsTypography variant="Regular_14">this process may take up to 20 seconds.</DsTypography>
        </div>
    );

export default FetchingDialog;
