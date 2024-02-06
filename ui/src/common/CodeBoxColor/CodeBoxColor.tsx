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

    const valueCheckColor = (value: string | any) => {
        const isNum = /^\d+$/.test(value);
        const isBool = value === true || value === false;
        if (isNum) {
            return (
                <div className={styles.infoColor}>
                    {`${value}`}
                    <span className={styles.commaColor}>,</span>
                </div>
            );
        }
        if (isBool) {
            return (
                <div className={styles.boolColor}>
                    {`${value}`}
                    <span className={styles.commaColor}>,</span>
                </div>
            );
        }
        return (
            <div className={styles.green40Color}>
                {`"${value}"`}
                <span className={styles.commaColor}>,</span>
            </div>
        );
    };
    const renderProperties = (obj: any) => {
        return obj
            ? Object.entries(obj).map(([key, value]) => {
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
                                  {!value && typeof value !== 'boolean' ? (
                                      <div className={styles.red20Color}>
                                          {`"${value || ''}"`}
                                          <span className={styles.commaColor}>,</span>
                                      </div>
                                  ) : (
                                      valueCheckColor(value)
                                  )}
                              </div>
                          )
                      );
                  }
              })
            : null;
    };

    return (
        actualData && (
            <div className={styles.codeBox}>
                <div style={{ width: 'max-content' }}>
                    {`curl --location --request POST ${baseUrl}/credentials/`}
                    <span className={credID === '<CredentialId>' ? `${styles.highlightWord}` : ''}>{`${credID}`}</span>
                    <span>{`/regions/`}</span>
                    <span className={region === '<Region>' ? `${styles.highlightWord}` : ''}>{`${region}`}</span>
                    <span>/cloudformation/deploy' \\</span>
                </div>
                <div>
                    <span>--header 'Authorization: Bearer </span>
                    <span className={styles.highlightWord}>{CRED_PLACEHOLDERS.TOKEN}</span>
                    <span> \</span>
                </div>
                <div>{`--header 'Content-Type: application/json' \\`}</div>
                <div>{`--data-raw '{`}</div>
                <div className={styles.marginFIfteen}>{renderProperties(actualData)}</div>
                <div className={styles.marginFIfteen}>{`}'`}</div>
            </div>
        )
    );
};

export default CodeBoxColor;
