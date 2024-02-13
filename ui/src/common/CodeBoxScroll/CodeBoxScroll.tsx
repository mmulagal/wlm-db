import { useState, useRef } from 'react';
import { Typography } from '@netapp/design-system';
import styles from './CodeBoxScroll.module.scss';
import { CODE_VIEWER } from '../../utils/appConstants';

type CodeBoxScrollType = {
    dropDownValue: string;
    setDisplayedDataInCodeBox: any;
};

const CodeBoxScroll = ({ dropDownValue, setDisplayedDataInCodeBox }: CodeBoxScrollType) => {
    const [scrollPosition, setScrollPosition] = useState(0);
    const [scrollTopPosition, setScrollTopPosition] = useState(0);
    const [reachedHorizontalEnd, setReachedHorizontalEnd] = useState(false);
    const [reachedVerticalEnd, setReachedVerticalEnd] = useState(false);

    const containerRef = useRef(null);

    const handleScrollLeft = () => {
        const container = containerRef?.current;
        //@ts-ignore
        const isEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth;
        //@ts-ignore
        const isTopEnd = container.scrollTop + container.clientHeight >= container.scrollHeight;
        setReachedVerticalEnd(isTopEnd);
        setReachedHorizontalEnd(isEnd);
        //@ts-ignore
        setScrollPosition(containerRef?.current?.scrollLeft);
        //@ts-ignore
        setScrollTopPosition(containerRef?.current?.scrollTop);
    };

    const dynamicClassForContent = () => {
        if (reachedHorizontalEnd && !reachedVerticalEnd) {
            return `${styles.firstBlock} ${styles.addMargin}`;
        } else {
            return `${styles.firstBlock}`;
        }
    };
    return (
        <div
            className={
                dropDownValue === CODE_VIEWER.CLOUDFORMATION
                    ? `${styles.payloadBody} ${styles.payloadBodyHeight}`
                    : `${styles.payloadBody}`
            }
        >
            <div className={styles.scrollContainer} onScroll={handleScrollLeft} ref={containerRef}>
                <div className={styles.scrollLeft}>
                    <div className={styles.setHorizontalScroll}>
                        <Typography
                            variant="Regular_14"
                            style={{ color: 'var(--white)' }}
                            className={dynamicClassForContent()}
                        >
                            {setDisplayedDataInCodeBox}
                        </Typography>
                        <div
                            className={styles.empty}
                            style={{
                                position: 'relative',
                                left: `${scrollPosition}px` // Move the div based on scroll position
                            }}
                        />
                    </div>
                    <div
                        className={
                            reachedVerticalEnd
                                ? `${styles.setVerticalScroll} ${styles.addVerticalMargin}`
                                : `${styles.setVerticalScroll}`
                        }
                        style={{
                            position: 'relative',
                            top: `${scrollTopPosition}px` // Move the div based on scroll position
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

export default CodeBoxScroll;
