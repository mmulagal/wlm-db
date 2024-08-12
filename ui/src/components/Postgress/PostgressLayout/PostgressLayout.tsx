import { AccordionController, Button, Typography } from '@netapp/design-system';
import styles from './PostgressLayout.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';

function PostgressLayout() {
    return (
        <div className={`${styles['aws-settings']} ${CommonStyles['accordion-group']} ${styles.protectLayout}`}>
            <AccordionController isGrouped>
                <Typography
                    style={{
                        padding: '0 0 8px'
                    }}
                    variant="Semibold_16"
                    className={styles.adjustMargin}
                >
                    {'Type 1'}
                </Typography>

                <Typography
                    style={{
                        padding: '0 0 8px'
                    }}
                    variant="Semibold_16"
                    className={styles.adjustMargin}
                >
                    {'Type 2'}
                </Typography>

                <Typography
                    style={{
                        padding: '0 0 8px'
                    }}
                    variant="Semibold_16"
                    className={styles.adjustMargin}
                >
                    {'Type 3'}
                </Typography>
            </AccordionController>
        </div>
    );
}

export default PostgressLayout;
