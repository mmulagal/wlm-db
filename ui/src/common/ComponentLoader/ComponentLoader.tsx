import React from 'react';
import styles from './ComponentLoader.module.scss';

export default ({ style }: { style?: any }) => {
    return (
        <div className={styles['base']} style={style}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" overflow="visible">
                <circle cx="25" cy="25" r="20" fill="none" strokeWidth="3" />
            </svg>
        </div>
    );
};
