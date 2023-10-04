import React from 'react';
import styles from './ProtectionSection.module.scss';
import { Typography } from '@netapp/design-system';
import MultiRingDoughnut from '../MultiRingDoughnut/MultiRingDoughnut';

const ProtectionSection = () => {
    return (
        <div className={styles.protectionSection}>
            <div className={styles.headSection}>
                <Typography variant="Regular_16">Protection</Typography>
            </div>

            <div className={styles.secondContainer}>
                <MultiRingDoughnut />

                <div className={styles.secondLevel}>
                    <Typography variant="Semibold_14">Database protection</Typography>
                    <div className={styles.separatorProtection} />
                    <div className={styles.row}>
                        <div className={styles.firstPart}>
                            <div className={styles.square} style={{ backgroundColor: '#68C6B3' }} />
                            <Typography variant="Regular_14">Protected</Typography>
                        </div>

                        <div className={styles.secondPart}>
                            <Typography variant="Semibold_14">80 %</Typography>
                            <div className={styles.separatorSecondPart} />
                            <Typography variant="Regular_14">18 Databases</Typography>
                        </div>
                    </div>

                    <div className={styles.separatorProtection} />
                    <div className={styles.row}>
                        <div className={styles.firstPart}>
                            <div className={styles.square} style={{ backgroundColor: '#FDC300' }} />
                            <Typography variant="Regular_14">Unprotected</Typography>
                        </div>

                        <div className={styles.secondPart}>
                            <Typography variant="Semibold_14">20 %</Typography>
                            <div className={styles.separatorSecondPart} />
                            <Typography variant="Regular_14">6 Databases</Typography>
                        </div>
                    </div>
                    <div className={styles.separatorProtection} />
                </div>

                {/* 3rd Row */}
                <div className={styles.secondLevel}>
                    <Typography variant="Semibold_14">Protected database distribution</Typography>
                    <div className={styles.separatorProtection} />
                    <div className={styles.row}>
                        <div className={styles.firstPart}>
                            <div className={styles.square} style={{ backgroundColor: '#012CAD' }} />
                            <Typography variant="Regular_14">AWS backup</Typography>
                        </div>

                        <div className={styles.secondPart}>
                            <Typography variant="Semibold_14">20 %</Typography>
                            <div className={styles.separatorSecondPart} />
                            <Typography variant="Regular_14">5 Databases</Typography>
                        </div>
                    </div>

                    <div className={styles.separatorProtection} />
                    <div className={styles.row}>
                        <div className={styles.firstPart}>
                            <div className={styles.square} style={{ backgroundColor: '#A815F3' }} />
                            <Typography variant="Regular_14">FSx ONTAP Snapshots</Typography>
                        </div>

                        <div className={styles.secondPart}>
                            <Typography variant="Semibold_14">20 %</Typography>
                            <div className={styles.separatorSecondPart} />
                            <Typography variant="Regular_14">4 Databases</Typography>
                        </div>
                    </div>
                    <div className={styles.separatorProtection} />
                    <div className={styles.row}>
                        <div className={styles.firstPart}>
                            <div className={styles.square} style={{ backgroundColor: '#0BAFFC' }} />
                            <Typography variant="Regular_14">Native SQL server backup</Typography>
                        </div>

                        <div className={styles.secondPart}>
                            <Typography variant="Semibold_14">40 %</Typography>
                            <div className={styles.separatorSecondPart} />
                            <Typography variant="Regular_14">9 Databases</Typography>
                        </div>
                    </div>
                    <div className={styles.separatorProtection} />
                </div>
            </div>
        </div>
    );
};

export default ProtectionSection;
