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
const css = (strings: any, ...values: any) =>
    strings
        .map((e: any, i: any) => [e, values[i]])
        .flat()
        .join(' ');

const ThemeProvider = React.memo(
    ({ children, theme, isRoot, className }: { className?: string; children: any; theme: string; isRoot: boolean }) => {
        const wrapperRef = useRef<HTMLDivElement>(null);

        useEffect(() => {
            // @ts-ignore
            const style = styles[theme];
            if (!style) {
                return;
            }
            const generatedString = style(css, palette);

            if (isRoot) {
                const styleTag = window.document.createElement('style');

                // Create a text node for the style content and append it to the style tag
                const styleContent = `
                    :root, ::before, ::after {
                        ${generatedString};
                        ${theme === 'dark' ? 'color-scheme: dark;' : ''}
                    }
                `;
                styleTag.appendChild(document.createTextNode(styleContent));

                // @ts-ignore
                ThemeProvider.activeStyles = generatedString;

                document.head.appendChild(styleTag);

                return () => {
                    document.head.removeChild(styleTag);
                };
            }
            if (wrapperRef.current) {
                wrapperRef.current.setAttribute('style', generatedString); // Set the generated styles directly
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
