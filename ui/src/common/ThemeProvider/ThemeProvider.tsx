import React, { useEffect, useRef } from 'react';
import palette from './palette.js';
import lightStyles from './lightStyles.js';
import darkStyles from './darkStyles.js';

const styles = {
    light: lightStyles,
    dark: darkStyles
};

/**
 * Template function does nothing, but webstorm uses it to properly syntax highlight css
 */
const css = (strings: any, ...values: any) => {
    return strings
        .map(function (e: any, i: any) {
            return [e, values[i]];
        })
        .flat()
        .join(' ');
};

const ThemeProvider = React.memo(
    ({ children, theme, isRoot, className }: { className?: string; children: any; theme: string; isRoot: boolean }) => {
        const wrapperRef = useRef<HTMLDivElement>(null);
        useEffect(() => {
            //@ts-ignore
            const style = styles[theme];
            if (!style) {
                return;
            }
            const generatedString = style(css, palette);
            if (isRoot) {
                const styleTag = window.document.createElement('style');

                styleTag.innerHTML = `
                :root, ::before, ::after {
                    ${generatedString};
                    ${theme === 'dark' ? 'color-scheme: dark;' : ''}
                }
            `;
                // @ts-ignore
                ThemeProvider.activeStyles = generatedString;

                document.head.appendChild(styleTag);

                return () => {
                    document.head.removeChild(styleTag);
                };
            } else {
                if (wrapperRef.current) {
                    wrapperRef.current.setAttribute('style', generatedString);
                    // wrapperRef.current.style.height = "100%";
                }
            }
        }, [theme, isRoot]);

        return (
            <div ref={wrapperRef} className={className}>
                {children}
            </div>
        );
    }
);

export default ThemeProvider;
