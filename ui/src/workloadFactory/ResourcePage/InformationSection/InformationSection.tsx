import { useState } from 'react';
import { FlashingDotsLoader, Typography } from '@netapp/design-system';

import { GENERAL } from '../../../utils/appConstants';
import SQLServer from './SQLServer/SQLServer';
import Location from './Location/Location';
import StorageCompute from './StorageCompute/StorageCompute';

import styles from './InformationSection.module.scss';
import ISConnectivity from './ISConnectivity/ISConnectivity';
import ISActiveDirectory from './ISActiveDirectory/ISActiveDirectory';
import { useAppSelector } from '../../../store/storeHooks';

const InformationSection = () => {
    const { resourceLoading } = useAppSelector(state => state.workloadFactoryResource);
    const [openKey, setOpenKey] = useState('');
    const disabled: boolean = resourceLoading;

    const handleToggle = (key: any) => {
        if (!disabled) {
            setOpenKey(openKey !== key ? key : null);
        }
    };
    return (
        <div className={styles.informationSection}>
            <div className={styles.headSection}>
                <Typography variant="Regular_16" className={styles.title}>
                    {GENERAL.DB_OVERVIEW_INFO}
                </Typography>
                {resourceLoading && <FlashingDotsLoader />}
            </div>

            <div className={styles.accordionSection}>
                <SQLServer handleToggle={handleToggle} openKey={openKey} />
                <Location handleToggle={handleToggle} openKey={openKey} />
                <StorageCompute handleToggle={handleToggle} openKey={openKey} />
                <ISConnectivity handleToggle={handleToggle} openKey={openKey} />
                <ISActiveDirectory handleToggle={handleToggle} openKey={openKey} />
            </div>
        </div>
    );
};

export default InformationSection;
