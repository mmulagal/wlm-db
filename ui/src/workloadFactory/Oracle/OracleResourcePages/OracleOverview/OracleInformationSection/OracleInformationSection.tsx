import { useState } from 'react';
import { DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import { useAppSelector } from '../../../../../store/storeHooks';
import Location from '../../../../ResourcePage/InformationSection/Location/Location';
import StorageCompute from '../../../../ResourcePage/InformationSection/StorageCompute/StorageCompute';
import ISConnectivity from '../../../../ResourcePage/InformationSection/ISConnectivity/ISConnectivity';
import styles from './OracleInformationSection.module.scss';
import { GENERAL } from '../../../../../utils/appConstants';
import OracleServer from '../../../../ResourcePage/InformationSection/SQLServer/OracleServer';
import { DBType } from '../../../../../utils/consts';

const OracleInformationSection = () => {
    const { resourceLoading, resourceDetails } = useAppSelector(state => state.oracleSlice);
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
                <DsTypography variant="Regular_16" className={styles.title}>
                    {GENERAL.DB_OVERVIEW_INFO}
                </DsTypography>
                {resourceLoading && <DsFlashingDotsLoader />}
            </div>

            <div className={styles.accordionSection}>
                <OracleServer handleToggle={handleToggle} openKey={openKey} />
                <Location
                    handleToggle={handleToggle}
                    openKey={openKey}
                    resourceDetails={resourceDetails}
                    resourceLoading={resourceLoading}
                />
                <StorageCompute
                    handleToggle={handleToggle}
                    openKey={openKey}
                    resourceDetails={resourceDetails}
                    resourceLoading={resourceLoading}
                    engineType={DBType.ORACLE}
                />
                <ISConnectivity
                    handleToggle={handleToggle}
                    openKey={openKey}
                    resourceDetails={resourceDetails}
                    resourceLoading={resourceLoading}
                />
            </div>
        </div>
    );
};

export default OracleInformationSection;
