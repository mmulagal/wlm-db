import { CREATE_SANDBOX_ENDPOINT, CRED_PLACEHOLDERS } from '../../../../utils/consts';
import styles from './ConnectToCiCd.module.scss';

const renderProperties = (obj: any) => {
    return obj
        ? Object.entries(obj).map(([key, value]) => {
              return (
                  value !== undefined && (
                      <div className={styles.startFlex} key={key}>
                          <div>{`"${key}": `}</div>&nbsp;
                          {/* @ts-ignore */}
                          {
                              <div>
                                  {`"${value}"`}
                                  <span>,</span>
                              </div>
                          }
                      </div>
                  )
              );
          })
        : null;
};

const ConnectToCiCdContent = ({ baseUrl, credID, region, databaseHostId, sandboxName, actualData }: any) => {
    return (
        <div className={styles.codeBox}>
            <div style={{ width: 'max-content' }}>
                {`curl --location --request PATCH ${baseUrl}/credentials/`}
                <span className={credID === '<CredentialId>' ? `${styles.highlightWord}` : ''}>{`${credID}`}</span>
                <span>{`/regions/`}</span>
                <span className={region === '<Region>' ? `${styles.highlightWord}` : ''}>{`${region}`}</span>
                <span>{`/database-hosts/${databaseHostId}`}</span>
                <span>{`${CREATE_SANDBOX_ENDPOINT}/${sandboxName}`}' \\</span>
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
    );
};

export default ConnectToCiCdContent;
