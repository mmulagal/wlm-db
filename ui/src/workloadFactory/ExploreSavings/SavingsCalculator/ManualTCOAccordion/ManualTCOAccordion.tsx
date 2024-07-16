import { DsAccordion } from '@netapp/design-system';
import styles from './ManualTCOAccordion.module.scss';
import SecondaryManualEC2 from '../ManualEC2/SecondaryManualEC2';
import SecondaryManualVolType from '../ManualVolumeTypes/SecondaryManualVolType';

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
                        <SecondaryManualEC2 />
                        <SecondaryManualVolType />
                    </div>
                }
            />
        </div>
    );
};

export default ManualTCOAccordion;
