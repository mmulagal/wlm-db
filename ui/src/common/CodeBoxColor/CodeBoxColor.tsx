import { getBaseUrl } from '../../utils/apiService';
import { CRED_PLACEHOLDERS } from '../../utils/consts';
import styles from './CodeBoxColor.module.scss';

type codeBoxTypes = {
    credID: string;
    region: string;
    actualData: any;
};

const CodeBoxColor = ({ credID, region, actualData }: codeBoxTypes) => {
    const baseUrl = getBaseUrl();
    const renderProperties = (obj: any) => {
        return Object.entries(obj).map(([key, value]) => {
            if (Array.isArray(value)) {
                return (
                    <div>
                        <div className={styles.startArray}>{`"${key}": [`} </div>
                        {value.map(item => {
                            if (typeof item === 'object') {
                                return (
                                    <div className={styles.marginFIfteen} key={key}>
                                        <div className={styles.marginFIfteen}>{`{`}</div>
                                        <div className={styles.marginThirty}>
                                            {`"key":  `}
                                            <span className={styles.green40Color}>{`"${item.key}",`}</span>
                                        </div>
                                        {/* @ts-ignore */}
                                        <div className={styles.marginThirty}>
                                            {`"value": `}
                                            <span className={styles.green40Color}>{`"${item.value}"`}</span>
                                        </div>
                                        <div className={styles.marginFIfteen}>{`}`}</div>
                                    </div>
                                );
                            }
                            return <div className={styles.singleArrayItem}>{`${item},`}</div>;
                        })}
                        <div className={styles.marginFIfteen}>{`]`}</div>
                    </div>
                );
            } else if (typeof value === 'object') {
                return (
                    <div key={key}>
                        <div className={styles.blue50Color}>{`"${key}": {`} </div>
                        <div>{renderProperties(value)}</div>
                        <div>{`},`}</div>
                    </div>
                );
            } else {
                return (
                    value !== undefined && (
                        <div className={styles.startFlex} key={key}>
                            <div className={styles.blue50Color}>{`"${key}": `}</div>&nbsp;
                            {/* @ts-ignore */}
                            {!value && (typeof value !== 'boolean') ? (
                                <div className={styles.red20Color}>{`"${value || ''}",`}</div>
                            ) : (
                                <div className={styles.green40Color}>{`"${value}",`}</div>
                            )}
                        </div>
                    )
                );
            }
        });
    };

    return (
        <div className={styles.codeBox}>
            <div>
                {`curl --location --request POST ${baseUrl}/credentials/${credID}/regions/${region}/cloudformation/stack' \\`}
            </div>
            <div>
                <span>--header 'Authorization: Bearer </span>
                <span className={styles.tokenStyle}>{CRED_PLACEHOLDERS.TOKEN}</span>
                <span> \</span>
            </div>
            <div>{`--header 'Content-Type: application/json' \\`}</div>
            <div>{`--data-raw '{`}</div>
            <div className={styles.marginFIfteen}>{renderProperties(actualData)}</div>
            <div className={styles.marginFIfteen}>{`}'`}</div>
        </div>
    );
};

export default CodeBoxColor;
