import { DsAccordion } from '@netapp/design-system';
import styles from './ManualTCOAccordion.module.scss';
import ManualEC2 from '../ManualEC2/ManualEC2';
import ManualVolumeTypes from '../ManualVolumeTypes/ManualVolumeTypes';

const ManualTCOAccordion = () => {
    return (
        <div className={styles.manualAccordion}>
            <DsAccordion
                id="1"
                title={'Secondary EC2 specifications'}
                variant="Default"
                value=""
                children={
                    <div>
                        <ManualEC2 />
                        <ManualVolumeTypes />
                    </div>
                }
            />
        </div>
    );
};

export default ManualTCOAccordion;
