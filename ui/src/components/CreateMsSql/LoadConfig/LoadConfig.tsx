import { RadioButton } from '@netapp/design-system';
import { useState } from 'react';
import { GENERAL } from '../../../utils/appConstants';
import styles from './LoadConfig.module.scss';

const LoadConfig = () => {
    const configs = [
        'MyQuickConfig',
        'bMyQuickCalforniaRegion',
        'cMyQuickCalforniaRegion',
        'dMyQuickCalforniaRegion',
        'eMyQuickCalforniaRegion',
        'fMyQuickCalforniaRegion',
        'fMyQuickCalforniaRegion1',
        'fMyQuickCalforniaRegion2',
        'fMyQuickCalforniaRegion3'
    ];
    const [selectedConfig, setSelectedConfig] = useState(configs[0]);

    const handleChange = (item: any) => {
        setSelectedConfig(item);
    };
    return (
        <div className={styles['load-config']}>
            <div className={styles.content}>{GENERAL.LOAD_CONFIG_CONTENT}</div>
            <div className={styles.radioContainer}>
                {configs.map((item, index) => (
                    <div className={index === 0 ? `${styles.item} ${styles.firstItem}` : `${styles.item}`} key={index}>
                        <RadioButton
                            isChecked={selectedConfig === item}
                            onChange={() => handleChange(item)}
                            children={item}
                            className=""
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LoadConfig;
