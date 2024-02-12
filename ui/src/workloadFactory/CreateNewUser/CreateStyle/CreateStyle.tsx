import { useState } from 'react';

import CardComponentConfig from '../../../common/CardComponent/CardComponentConfig';

import { ReactComponent as BlueTick } from '../../../assets/blue-tick.svg';
import { ReactComponent as EasyCreate } from '../../../assets/Quick create.svg';
import styles from './CreateStyle.module.scss';
import { SELECT_CONFIG } from '../../../utils/appConstants';

const CreateStyle = () => {
    const [selectedNewUserConfig, setSelectedNewUserConfig] = useState('Quick Create');
    const clickHandler = (val: string) => {
        setSelectedNewUserConfig(val);
    };
    return (
        <div className={styles.createStyle}>
            <CardComponentConfig
                idToAdd="new-user-quick-create"
                selectedConfigCondition={selectedNewUserConfig === 'Quick Create'}
                icon={<EasyCreate />}
                tickIcon={<BlueTick />}
                heading={SELECT_CONFIG.QUICK_CREATE}
                content={SELECT_CONFIG.EASY_CREATE_CONTENT}
                handleClick={() => clickHandler('Quick Create')}
            />

            <CardComponentConfig
                idToAdd="new-user-standard-create"
                selectedConfigCondition={selectedNewUserConfig === 'Standard Create'}
                icon={<EasyCreate />}
                tickIcon={<BlueTick />}
                heading={SELECT_CONFIG.QUICK_CREATE}
                content={SELECT_CONFIG.EASY_CREATE_CONTENT}
                handleClick={() => clickHandler('Standard Create')}
            />
        </div>
    );
};

export default CreateStyle;
