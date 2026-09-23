import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
    id: string;
    name: string;
}

interface MultiSelectDropdownProps {
    options: Option[];
    selected: string[];
    onChange: (selectedIds: string[]) => void;
    placeholder?: string;
}

export const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
    options,
    selected,
    onChange,
    placeholder = "Select options..."
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (id: string) => {
        if (selected.includes(id)) {
            onChange(selected.filter(item => item !== id));
        } else {
            onChange([...selected, id]);
        }
    };

    const selectedOptionsText = selected.length > 0
        ? options.filter(opt => selected.includes(opt.id)).map(opt => opt.name).join(', ')
        : placeholder;

    return (
        <div className="relative" ref={dropdownRef}>
            <div 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white cursor-pointer flex justify-between items-center hover:border-indigo-500 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={`truncate ${selected.length === 0 ? 'text-slate-400' : 'text-slate-900'}`}>
                    {selectedOptionsText}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    {options.length === 0 ? (
                        <div className="p-3 text-sm text-slate-500 text-center">No options available</div>
                    ) : (
                        options.map(option => {
                            const isSelected = selected.includes(option.id);
                            return (
                                <div 
                                    key={option.id}
                                    className={`px-4 py-2 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors ${isSelected ? 'bg-indigo-50/50' : ''}`}
                                    onClick={() => toggleOption(option.id)}
                                >
                                    <div className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                    </div>
                                    <span className="text-sm text-slate-700">{option.name}</span>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};
