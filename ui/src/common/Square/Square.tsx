import React from 'react';

type SQ = {
    width: string;
    height: string;
    background: string;
};

const Square = ({ width, height, background }: SQ) => <div style={{ width, height, background }} />;

export default Square;
