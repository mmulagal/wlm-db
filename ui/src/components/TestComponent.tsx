import React, { useState, useEffect } from 'react';

const TestComponent = () => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        // Removed console.log to avoid ESLint error
    }, [count]);

    return (
        <div>
            <p>Count: {count}</p>
            <button onClick={() => setCount(count + 1)}>Increment</button>
        </div>
    );
};

export default TestComponent;
