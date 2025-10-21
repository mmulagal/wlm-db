import { DsTypography } from '@tlveng/wlm-ds';
import styles from './WellArchitectedTab.module.scss';

const WellArchitectedTab = () => {
    return (
        <div className={styles['well-architected-tab']}>
            <DsTypography variant="Regular_14">Well-architected</DsTypography>
        </div>
    );
};

export default WellArchitectedTab;
