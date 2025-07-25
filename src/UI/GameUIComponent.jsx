// GameUIComponent.jsx - Base abstract component for all UI elements
import React, { useState, useEffect, useRef } from 'react';

const GameUIComponent = ({
    position = { row: 1, col: 1 },
    sprites = {
        normal: null,
        hover: null,
        pressed: null,
        disabled: null
    },
    alpha = {
        normal: 1,
        hover: 1,
        pressed: 0.9,
        disabled: 0.5
    },
    text = '',
    state = 'normal', // normal, hover, pressed, disabled
    controlledState = false,
    tabIndex = 0,
    onClick = null,
    onSelect = null,
    enabled = true,
    className = '',
    children = null,
    style = {},
    ...props
}) => {
    const [currentState, setCurrentState] = useState(state);
    const componentRef = useRef(null);

    // Update state when prop changes
    useEffect(() => {
        if (controlledState) {
            setCurrentState(state);
        } else {
            setCurrentState(enabled ? state : 'disabled');
        }
    }, [state, enabled, controlledState]);

    const handleClick = (e) => {
        if (!enabled) return;
        if (onClick) onClick(e);
        if (onSelect) onSelect(e);
    };

    const handleMouseEnter = () => {
        if (!enabled || controlledState) return;
        setCurrentState('hover');
    };

    const handleMouseLeave = () => {
        if (!enabled || controlledState) return;
        setCurrentState('normal');
    };

    const handleMouseDown = () => {
        if (!enabled || controlledState) return;
        setCurrentState('pressed');
    };

    const handleMouseUp = () => {
        if (!enabled || controlledState) return;
        setCurrentState('hover');
    };

    // Handle keyboard navigation
    const handleKeyDown = (e) => {
        if (!enabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick(e);
        }
    };

    // Get current sprite and alpha based on state
    const currentSprite = sprites[currentState] || sprites.normal;
    const currentAlpha = alpha[currentState] || alpha.normal || 1;

    const componentStyle = {
        gridRow: position.row,
        gridColumn: position.col,
        backgroundImage: currentSprite ? `url(${currentSprite})` : undefined,
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        opacity: currentAlpha,
        imageRendering: 'pixelated',
        WebkitImageRendering: 'pixelated',
        MozImageRendering: 'crisp-edges',
        msImageRendering: 'crisp-edges',
        ...style
    };

    return (
        <div
            ref={componentRef}
            className={`game-ui-component game-ui-component--${currentState} ${className}`}
            style={componentStyle}
            tabIndex={enabled ? tabIndex : -1}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onKeyDown={handleKeyDown}
            {...props}
        >
            {text && <span className="game-ui-text">{text}</span>}
            {children}
        </div>
    );
};

export default GameUIComponent;