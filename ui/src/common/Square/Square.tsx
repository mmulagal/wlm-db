import React from 'react';

type SQ = {
    width: string;
    height: string;
    background: string;
};

const Square = ({ width, height, background }: SQ) => {
    return <div style={{ width: width, height: height, background: background }} />;
};

export default Square;
