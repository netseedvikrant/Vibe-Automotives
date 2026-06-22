import React, { useState, useEffect, useRef } from 'react';

const CustomSelect = ({ id, name, required, children, icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState('');
  const wrapperRef = useRef(null);

  // Flatten children — handles arrays, fragments, and direct elements
  const flattenChildren = (kids) => {
    const result = [];
    React.Children.forEach(kids, (child) => {
      if (!child) return;
      // If it's an array or fragment, recurse
      if (child.type === React.Fragment) {
        flattenChildren(child.props.children).forEach(c => result.push(c));
      } else if (Array.isArray(child)) {
        flattenChildren(child).forEach(c => result.push(c));
      } else {
        result.push(child);
      }
    });
    return result;
  };

  const allChildren = flattenChildren(children);

  // Build options — only real <option> elements
  const options = allChildren
    .filter(child => child && child.type === 'option')
    .map((child, index) => {
      const rawValue = child.props.value;
      const label = child.props.children;
      const isPlaceholder = rawValue === '' || (rawValue === undefined && index === 0);
      return {
        value: rawValue !== undefined ? rawValue : String(label),
        label: String(label),
        isPlaceholder,
      };
    });

  const selectedOption = options.find(o => !o.isPlaceholder && o.value === selectedValue);
  const placeholder = options.find(o => o.isPlaceholder) || { label: 'Select' };

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Re-evaluate if children change (e.g. leadEngineers loads async)
  useEffect(() => {
    // If current selectedValue no longer exists in options, reset
    const stillValid = options.some(o => !o.isPlaceholder && o.value === selectedValue);
    if (selectedValue && !stillValid) setSelectedValue('');
  }, [children]); // eslint-disable-line

  const handleSelect = (opt) => {
    if (opt.isPlaceholder) return;
    setSelectedValue(opt.value);
    setIsOpen(false);
  };

  return (
    <div className="custom-select-wrapper" ref={wrapperRef}>
      {/* Hidden input keeps FormData working */}
      <input
        type="hidden"
        id={id}
        name={name}
        value={selectedValue}
        required={required}
      />

      <div
        className={`custom-select-trigger${isOpen ? ' open' : ''}`}
        onClick={() => setIsOpen(prev => !prev)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setIsOpen(prev => !prev)}
      >
        {icon && <span className="select-icon">{icon}</span>}
        <span className={selectedOption ? 'selected-text' : 'placeholder-text'}>
          {selectedOption ? selectedOption.label : placeholder.label}
        </span>
        <svg
          className={`chevron${isOpen ? ' rotated' : ''}`}
          width="16" height="16" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {isOpen && (
        <div className="custom-select-dropdown">
          {options.map((opt, idx) => (
            <div
              key={`${opt.value}-${idx}`}
              className={[
                'custom-select-option',
                opt.isPlaceholder ? 'placeholder-option' : '',
                !opt.isPlaceholder && opt.value === selectedValue ? 'active' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => handleSelect(opt)}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomSelect;