import { useMemo, useState } from 'react';

const useHover = () => {
    const [isHovered, setIsHover] = useState<boolean>(false);
    return useMemo(
        () => ({
            isHovered,
            hoverParentProps: {
                onMouseEnter: () => setIsHover(true),
                onMouseLeave: () => setIsHover(false)
            }
        }),
        [isHovered]
    );
};

export default useHover;
