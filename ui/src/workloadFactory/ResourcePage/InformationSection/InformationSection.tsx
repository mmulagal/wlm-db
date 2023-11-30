import { useState } from 'react';
import { Typography } from '@netapp/design-system';

import { GENERAL } from '../../../utils/appConstants';
import SQLServer from './SQLServer/SQLServer';
import Location from './Location/Location';
import StorageCompute from './StorageCompute/StorageCompute';

import styles from './InformationSection.module.scss';
import ISConnectivity from './ISConnectivity/ISConnectivity';
import ISActiveDirectory from './ISActiveDirectory/ISActiveDirectory';

const InformationSection = () => {
    const [openKey, setOpenKey] = useState('');

    const handleToggle = (key: any) => {
        setOpenKey(openKey !== key ? key : null);

        // else {
        //     setOpenedItem(key);
        // }
    };
    return (
        <div className={styles.informationSection}>
            <div className={styles.headSection}>
                <Typography variant="Regular_16" className={styles.title}>
                    {GENERAL.DB_OVERVIEW_INFO}
                </Typography>
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
