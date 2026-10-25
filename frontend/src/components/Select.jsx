import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';

export default function Select({ value, onChange, options, id, className = '' }) {
    const [open, setOpen] = useState(false);
    const [highlighted, setHighlighted] = useState(
        Math.max(0, options.findIndex((o) => o.value === value))
    );
    const rootRef = useRef(null);
    const buttonRef = useRef(null);

    const selected = options.find((o) => o.value === value) ?? options[0];

    useEffect(() => {
        function handleClickOutside(e) {
            if (rootRef.current && !rootRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        if (open) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [open]);

    useEffect(() => {
        if (!open) return;
        function handleKey(e) {
            if (e.key === 'Escape') {
                setOpen(false);
                buttonRef.current?.focus();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlighted((i) => Math.min(options.length - 1, i + 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlighted((i) => Math.max(0, i - 1));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const next = options[highlighted];
                if (next) {
                    onChange(next.value);
                    setOpen(false);
                }
            }
        }
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [open, highlighted, options, onChange]);

    function choose(option) {
        onChange(option.value);
        setOpen(false);
        buttonRef.current?.focus();
    }

    return (
        <div ref={rootRef} className={`relative ${className}`}>
            <button
                ref={buttonRef}
                id={id}
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="field flex w-full items-center justify-between gap-2 text-left"
            >
                <span className="truncate">{selected?.label}</span>
                <motion.span
                    animate={{ rotate: open ? 180 : 0 }}
                    transition={{ duration: 0.18 }}
                    className="text-slate-400"
                >
                    <ChevronDown size={16} />
                </motion.span>
            </button>

            <AnimatePresence>
                {open && (
                    <motion.ul
                        role="listbox"
                        initial={{ opacity: 0, y: -4, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.98 }}
                        transition={{ duration: 0.14, ease: 'easeOut' }}
                        className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900"
                    >
                        {options.map((option, index) => {
                            const isSelected = option.value === value;
                            const isHighlighted = index === highlighted;
                            return (
                                <li key={option.value} role="option" aria-selected={isSelected}>
                                    <button
                                        type="button"
                                        onMouseEnter={() => setHighlighted(index)}
                                        onClick={() => choose(option)}
                                        className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${isHighlighted
                                                ? 'bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-100'
                                                : 'text-slate-700 dark:text-slate-200'
                                            }`}
                                    >
                                        <span className="truncate">{option.label}</span>
                                        {isSelected && (
                                            <Check size={14} className="shrink-0 text-brand-600" />
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </motion.ul>
                )}
            </AnimatePresence>
        </div>
    );
}