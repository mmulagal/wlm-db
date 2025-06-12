import { RadioButton, Spinner } from '@netapp/design-system';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { GENERAL } from '../../../utils/appConstants';
import styles from './LoadConfig.module.scss';
import { useDeleteConfigMutation, useGetConfigListQuery } from '../../../utils/apiService';
import { setLoadConfig } from '../../../store/mssql/mssqlFormSlice';
import { ReactComponent as DeleteIcon } from '../../../assets/delete-icon.svg';
import { useAppSelector } from '../../../store/storeHooks';
import { formatDateWithTime } from '../../../utils/utilityFunctions';
import { setIsWizardTouched } from '../../../store/chatbot/chatbotSlice';
import { WIZARD_TYPE } from '../../../utils/consts';

const LoadConfig = ({ formType = WIZARD_TYPE.MSSQL }: any) => {
    const dispatch = useDispatch();
    const [hoveredItem, setHoveredItem] = useState(null);

    const { configData, configLoading } = useAppSelector(state => state.mssql.getSavedConfigList);

    // API call to get configuration list
    const { refetch: configListRefetch } = useGetConfigListQuery({});

    const [deleteConfigApi] = useDeleteConfigMutation();

    const [selectedConfig, setSelectedConfig] = useState('');

    const filteredConfigdata = useMemo(
        () => configData?.filter((item: any) => item?.databaseType === formType),
        [configData]
    );

    useEffect(() => {
        if (filteredConfigdata && filteredConfigdata.length > 0) {
            setSelectedConfig(
                filteredConfigdata[0]?.name + filteredConfigdata[0]?.user + filteredConfigdata[0]?.creationTime
            );
            dispatch(setLoadConfig(filteredConfigdata[0]?.id));
        }
    }, [filteredConfigdata, dispatch]);

    const handleChange = (item: any) => {
        setSelectedConfig(item?.name + item?.user + item?.creationTime);
        dispatch(setLoadConfig(item?.id));
        dispatch(setIsWizardTouched(true));
    };

    const handleMouseEnter = (index: any) => {
        setHoveredItem(index);
    };

    const handleMouseLeave = () => {
        setHoveredItem(null);
    };

    const deleteConfig = (index: any) => {
        deleteConfigApi({ configId: filteredConfigdata[index]?.id }).then((data: any) => {
            if (!data?.error) {
                configListRefetch();
            }
        });
    };

    const configRows = (item: any) => {
        const value = `${item?.name}_${item?.user}_${formatDateWithTime(item?.creationTime || '')}`;
        return (
            <div className={styles.setRowWithSeperator} title={value}>
                {value}
            </div>
        );
    };

    return (
        <div className={styles['load-config']}>
            <div className={styles.content}>{GENERAL.LOAD_CONFIG_CONTENT}</div>
            <div className={styles.radioContainer}>
                {!configLoading &&
                    filteredConfigdata?.map((item: any, index: any) => (
                        <div
                            className={index === 0 ? `${styles.item} ${styles.firstItem}` : `${styles.item}`}
                            key={index}
                            onMouseEnter={() => handleMouseEnter(index)}
                            onMouseLeave={handleMouseLeave}
                        >
                            <div className={styles.setRow}>
                                <div className={styles.radiobutton}>
                                    <RadioButton
                                        isChecked={selectedConfig === item?.name + item?.user + item?.creationTime}
                                        onChange={() => handleChange(item)}
                                        children={configRows(item)}
                                        className=""
                                    />
                                </div>
                                {hoveredItem === index && (
                                    <div className={styles.icon}>
                                        <DeleteIcon onClick={() => deleteConfig(index)} />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                {configLoading && (
                    <div className={styles.loading}>
                        <Spinner />
                    </div>
                )}
            </div>
        </div>
    );
};

export default LoadConfig;
