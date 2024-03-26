import { ReactComponent as Source } from '../../../assets/Source.svg';
import { ReactComponent as Sandbox } from '../../../assets/Sandbox.svg';

import styles from './SourceInformation.module.scss';
import { DsTypography } from '@netapp/design-system';

const SourceInformation = () => {
    return (
        <div className={styles.sourceInformation}>
            <div className={styles.wrapperContainer}>
                <Source />
                <div className={styles.insideContainer}>
                    <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                        12
                    </DsTypography>
                    <DsTypography variant="Regular_14" style={{ width: '119px' }}>
                        Source databases
                    </DsTypography>
                </div>
            </div>

            <div className={styles.wrapperContainer}>
                <Sandbox />
                <div className={styles.insideContainer}>
                    <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                        120
                    </DsTypography>
                    <DsTypography variant="Regular_14">Sandboxes</DsTypography>
                </div>
            </div>
        </div>
    );
};

export default SourceInformation;
