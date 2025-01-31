import { DsTypography } from '@netapp/design-system';
import styles from './ComputeInformation.module.scss';
import ComputeInputComponent from './ComputeInputComponent/ComputeInputComponent';
import { useAppSelector } from '../../../../store/storeHooks';

const ComputeInformation = ({ printState }: any) => {
    const { onPremStorageAndComputeInfo }: any = useAppSelector(state => state.exploreSavings);

    return (
        <div className={styles.computeInformation}>
            <DsTypography style={{ marginBottom: '8px' }} variant="Regular_14">
                Compute information:
            </DsTypography>

            <div className={styles.computeTable}>
                <div className={styles.row1}>
                    <div className={styles.col1}></div>
                    <div className={styles.col2}>
                        <DsTypography variant="Semibold_14">Number of vCPUs in use</DsTypography>
                    </div>
                    <div className={styles.col3}>
                        <DsTypography variant="Semibold_14">Memory (GiB)</DsTypography>
                    </div>
                    <div className={styles.col4}>
                        <DsTypography variant="Semibold_14">Network performance</DsTypography>
                    </div>
                </div>
                {Object.keys(onPremStorageAndComputeInfo).map((key: any, index: any) => (
                    <div key={index} className={styles.row1} style={{ marginTop: '-8px' }}>
                        <div className={styles.col1}>
                            <DsTypography variant="Regular_14">
                                {onPremStorageAndComputeInfo[key]?.sqlInstanceName}
                            </DsTypography>
                        </div>
                        <ComputeInputComponent
                            data={onPremStorageAndComputeInfo[key]}
                            index={index}
                            printState={printState}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ComputeInformation;
