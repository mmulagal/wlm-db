import { DsAccordion } from '@netapp/design-system';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import styles from './ManualTCOAccordion.module.scss';
import SecondaryManualEC2 from '../ManualEC2/SecondaryManualEC2';
import SecondaryManualVolType from '../ManualVolumeTypes/SecondaryManualVolType';
import { useAppSelector } from '../../../../store/storeHooks';
import {
    setSecondaryVolDetails,
    setSelectedSecondaryManualInstanceType
} from '../../../../store/workloadFactory/exploreSavingsSlice';

const ManualTCOAccordion = () => {
    const { manualTCOVolumeTypes, selectedManualInstanceType } = useAppSelector(state => state.exploreSavings);
    const [openAccordion, setOpenAccordion] = useState(false);
    const dispatch = useDispatch();
    useEffect(() => {
        const obj = {
            io2: {
                manualTCONumberOfVolumes: manualTCOVolumeTypes?.io2?.manualTCONumberOfVolumes,
                manualTCOStorageAmount: manualTCOVolumeTypes?.io2.manualTCOStorageAmount,
                manualTCOProvisionedIOPS: manualTCOVolumeTypes?.io2.manualTCOProvisionedIOPS,
                manualTCOThroughput: manualTCOVolumeTypes?.io2.manualTCOThroughput
            },
            io1: {
                manualTCONumberOfVolumes: manualTCOVolumeTypes?.io1?.manualTCONumberOfVolumes,
                manualTCOStorageAmount: manualTCOVolumeTypes?.io1?.manualTCOStorageAmount,
                manualTCOProvisionedIOPS: manualTCOVolumeTypes?.io1?.manualTCOProvisionedIOPS,
                manualTCOThroughput: manualTCOVolumeTypes?.io1?.manualTCOThroughput
            },
            gp2: {
                manualTCONumberOfVolumes: manualTCOVolumeTypes?.gp2?.manualTCONumberOfVolumes,
                manualTCOStorageAmount: manualTCOVolumeTypes?.gp2?.manualTCOStorageAmount,
                manualTCOProvisionedIOPS: manualTCOVolumeTypes?.gp2?.manualTCOProvisionedIOPS,
                manualTCOThroughput: manualTCOVolumeTypes?.gp2?.manualTCOThroughput
            },
            gp3: {
                manualTCONumberOfVolumes: manualTCOVolumeTypes?.gp3?.manualTCONumberOfVolumes,
                manualTCOStorageAmount: manualTCOVolumeTypes?.gp3?.manualTCOStorageAmount,
                manualTCOProvisionedIOPS: manualTCOVolumeTypes?.gp3?.manualTCOProvisionedIOPS,
                manualTCOThroughput: manualTCOVolumeTypes?.gp3?.manualTCOThroughput
            },
            st1: {
                manualTCONumberOfVolumes: manualTCOVolumeTypes?.st1?.manualTCONumberOfVolumes,
                manualTCOStorageAmount: manualTCOVolumeTypes?.st1?.manualTCOStorageAmount,
                manualTCOProvisionedIOPS: manualTCOVolumeTypes?.st1?.manualTCOProvisionedIOPS,
                manualTCOThroughput: manualTCOVolumeTypes?.st1?.manualTCOThroughput
            }
        };
        dispatch(setSecondaryVolDetails(obj));
        dispatch(setSelectedSecondaryManualInstanceType(selectedManualInstanceType));
    }, [openAccordion]);
    return (
        <div className={styles.manualAccordion}>
            <DsAccordion
                id="1"
                title="Secondary EC2 specifications"
                variant="Default"
                value=""
                children={
                    <div>
                        <SecondaryManualEC2 />
                        <SecondaryManualVolType />
                    </div>
                }
                onClick={() => setOpenAccordion(prev => !prev)}
            />
        </div>
    );
};

export default ManualTCOAccordion;
