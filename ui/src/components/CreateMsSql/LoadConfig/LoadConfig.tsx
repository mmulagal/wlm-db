import { RadioButton } from '@netapp/design-system';
import { useEffect, useState } from 'react';
import { GENERAL } from '../../../utils/appConstants';
import styles from './LoadConfig.module.scss';
import { useGetConfigListQuery } from '../../../utils/apiService';

const LoadConfig = () => {
    // API call to get configuration list
    const {
        data: configData,
    } = useGetConfigListQuery({});

    const [selectedConfig, setSelectedConfig] = useState('');

    useEffect(() => {
        if(configData && configData.length > 0){
            setSelectedConfig(configData[0]?.id);
        }
    }, [configData]);
    
    const handleChange = (item: any) => {
        setSelectedConfig(item);
    };
    return (
        <div className={styles['load-config']}>
            <div className={styles.content}>{GENERAL.LOAD_CONFIG_CONTENT}</div>
            <div className={styles.radioContainer}>
                {configData?.map((item: any, index: any) => (
                    <div className={index === 0 ? `${styles.item} ${styles.firstItem}` : `${styles.item}`} key={index}>
                        <RadioButton
                            isChecked={selectedConfig === item?.id}
                            onChange={() => handleChange(item?.id)}
                            children={item?.id}
                            className=""
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LoadConfig;
