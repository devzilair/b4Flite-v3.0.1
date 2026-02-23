
import React from 'react';

interface LogoProps {
  className?: string;
  collapsed?: boolean;
}

const Logo: React.FC<LogoProps> = ({ className = "h-8 w-auto", collapsed = false }) => {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-auto text-current"
        aria-label="b4Flite Logo"
      >
        {/* Stylized Flight Icon */}
        <path
          d="M20 4L4 36L20 28L36 36L20 4Z"
          fill="currentColor"
          className="opacity-90"
        />
        <path
          d="M20 4L20 28L36 36L20 4Z"
          fill="black"
          fillOpacity="0.2"
        />
      </svg>
      
      {!collapsed && (
        <div className="ml-2 flex flex-col justify-center h-full">
            <div className="flex items-baseline leading-none">
                <span className="font-bold text-2xl tracking-tight" style={{ fontFamily: 'sans-serif' }}>b4</span>
                <span className="font-light text-2xl tracking-tight" style={{ fontFamily: 'sans-serif' }}>Flite</span>
                <span className="text-[0.5rem] align-top -mt-2 ml-0.5 font-medium">TM</span>
            </div>
        </div>
      )}
    </div>
  );
};

export default Logo;
