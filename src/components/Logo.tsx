import React from 'react';

interface LogoProps {
  variant?: 'full' | 'icon' | 'badge';
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Logo: React.FC<LogoProps> = ({ variant = 'full', className = '', size = 'md' }) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const textSizes = {
    sm: 'text-base leading-tight',
    md: 'text-xl leading-tight',
    lg: 'text-2xl leading-tight',
    xl: 'text-3xl leading-tight'
  };

  const VerduSymbol = () => (
    <svg 
      viewBox="0 0 100 100" 
      className={`${iconSizes[size]} shrink-0 rounded-lg shadow-sm`}
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="100" height="100" rx="14" fill="#0080D0" />
      {/* Authentic Verdu sinusoidal curve */}
      <path 
        d="M -5 38 C 15 38, 20 58, 50 80 C 80 58, 85 38, 105 38" 
        stroke="white" 
        strokeWidth="16" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </svg>
  );

  if (variant === 'icon') {
    return (
      <div className={`inline-flex items-center ${className}`}>
        <VerduSymbol />
      </div>
    );
  }

  if (variant === 'badge') {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0080D0] text-white shadow-sm ${className}`}>
        <svg viewBox="0 0 100 100" className="w-5 h-5 shrink-0" fill="none">
          <path 
            d="M -5 38 C 15 38, 20 58, 50 80 C 80 58, 85 38, 105 38" 
            stroke="white" 
            strokeWidth="18" 
            strokeLinecap="round" 
          />
        </svg>
        <span className="font-extrabold tracking-tight text-sm">Verdu y Cía.</span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      <VerduSymbol />
      <div className="flex flex-col">
        <div className="flex items-baseline gap-1.5">
          <span className={`font-black tracking-tight text-[#006bb0] ${textSizes[size]} font-sans`}>
            Verdu
          </span>
          <span className={`font-bold text-[#006bb0] ${size === 'xl' ? 'text-2xl' : size === 'lg' ? 'text-xl' : size === 'md' ? 'text-base' : 'text-sm'}`}>
            y Cía.
          </span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800/60 -mt-0.5">
          Gestión de Pañol e Inventario
        </span>
      </div>
    </div>
  );
};
