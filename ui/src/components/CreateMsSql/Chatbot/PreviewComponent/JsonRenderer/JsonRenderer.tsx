import styles from './JsonRenderer.module.scss';

type JsonRendererPropType = {
    jsonData: any;
};

const passwordFields = ['domainPassword', 'serviceAccountPassword', 'fsxPassword'];

const renderObj = (obj: any, level: number) => {
    const objKeys = Object.keys(obj);
    return (
        <div className={styles[`level-${level}`]}>
            {objKeys.map(key => {
                const isValNum = obj[key] && !isNaN(obj[key]);
                return (
                    <div className={styles['json-line']}>
                        <span className={styles['json-key']}>{`${key}:`}</span>
                        {typeof obj[key] === 'object' ? (
                            <>
                                {'{'}
                                {renderObj(obj[key], level + 1)}
                                {'},'}
                            </>
                        ) : (
                            <span
                                className={`${styles[`json-value`]} ${obj[key] ? '' : styles['empty-json-value']}`}
                            >{`${!isValNum ? '"' : ''}${
                                passwordFields.includes(key) && obj[key] ? '********' : obj[key]
                            }${!isValNum ? '"' : ''},`}</span>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

const JsonRenderer = ({ jsonData }: JsonRendererPropType) => {
    return (
        <div className={styles['json-renderer']}>
            {jsonData && Object.keys(jsonData).length && (
                <>
                    {'{'}
                    {renderObj(jsonData, 0)}
                    {'}'}
                </>
            )}
        </div>
    );
};

export default JsonRenderer;
