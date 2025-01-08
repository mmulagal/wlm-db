const HighlightText = ({ text, searchWords }: { text: any; searchWords: string[] }) => {
    if (!text) return null;

    // Create a regex from the search words
    const regex = new RegExp(`(${searchWords.join('|')})`, 'gi');

    // Split the text into parts and wrap matches in a <span>
    const parts = text.split(regex);

    return (
        <span>
            {parts.map((part: any, index: number) =>
                searchWords.some(word => word.toLowerCase() === part.toLowerCase()) ? (
                    <span key={index} style={{ color: 'var(--blue-30)', fontWeight: 'normal' }}>
                        {part}
                    </span>
                ) : (
                    part
                )
            )}
        </span>
    );
};

export default HighlightText;
