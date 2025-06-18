import { DsTypography } from '@netapp/design-system';

import styles from './CardComponent.module.scss';

const CardComponent = ({ image, title, desc }: any) => (
    <div className={styles.cardComponent}>
        <div className={styles.row1}>
            {image}
            <DsTypography variant="Semibold_16">{title}</DsTypography>
        </div>
        <DsTypography variant="Regular_14">{desc}</DsTypography>
    </div>
);

export default CardComponent;
