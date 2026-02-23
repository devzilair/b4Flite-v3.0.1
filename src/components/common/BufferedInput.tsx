
import React, { useState, useEffect } from 'react';

interface BufferedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    value: string | number | undefined;
    onCommit: (value: string) => void;
}

export const BufferedInput: React.FC<BufferedInputProps> = ({ value, onCommit, ...props }) => {
    const [localValue, setLocalValue] = useState<string>(value?.toString() || '');
    
    // Sync local value if external value changes (e.g. via reset or other external update)
    // We strictly check for inequality to avoid cursor jumps if this runs during typing
    useEffect(() => {
        if (value?.toString() !== localValue) {
            setLocalValue(value?.toString() || '');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalValue(e.target.value);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        if (localValue !== (value?.toString() || '')) {
            onCommit(localValue);
        }
        if (props.onBlur) props.onBlur(e);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur(); // Trigger blur to commit
        }
        if (props.onKeyDown) props.onKeyDown(e);
    };

    return (
        <input
            {...props}
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
        />
    );
};
