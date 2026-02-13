import React from 'react';

export const Skeleton = ({ className = '', width, height, circle }) => {
  return (
    <div 
      className={`bg-gray-700/50 animate-shimmer bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 bg-[length:1000px_100%] ${circle ? 'rounded-full' : 'rounded'} ${className}`} 
      style={{ width, height }}
    />
  );
};

export const AnimatedButton = ({ children, onClick, disabled, className = '', variant = 'primary', enableAnimations = true, ...props }) => {
  const baseClass = "relative overflow-hidden transition-all duration-200 active:scale-95 disabled:active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed font-medium rounded-lg flex items-center justify-center";
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-500 shadow-lg hover:shadow-blue-500/25",
    secondary: "bg-gray-700 hover:bg-gray-600",
    danger: "bg-red-600 hover:bg-red-500 shadow-lg hover:shadow-red-500/25",
    ghost: "hover:bg-gray-700/50 text-gray-300 hover:text-white",
    outline: "border border-gray-600 hover:border-gray-500 hover:bg-gray-800"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClass} ${variants[variant]} ${className} ${enableAnimations ? '' : '!transition-none !transform-none'}`}
      {...props}
    >
      {/* Ripple effect placeholder - can be expanded later */}
      {enableAnimations && !disabled && variant !== 'ghost' && (
        <span className="absolute inset-0 bg-white/5 opacity-0 hover:opacity-100 transition-opacity duration-200" />
      )}
      {children}
    </button>
  );
};

export const Card = ({ children, className = '', hover = false, enableAnimations = true }) => {
  return (
    <div 
      className={`
        bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 
        ${hover && enableAnimations ? 'hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/5 hover:border-gray-600 transition-all duration-300 ease-out will-change-transform' : ''} 
        ${className}
      `}
    >
      {children}
    </div>
  );
};

export const FadeIn = ({ children, delay = 0, direction = 'up', enableAnimations = true, className = '' }) => {
  if (!enableAnimations) return <div className={className}>{children}</div>;
  
  const animations = {
    up: 'animate-slide-up',
    down: 'animate-slide-down',
    scale: 'animate-scale-in',
    fade: 'animate-fade-in'
  };

  return (
    <div 
      className={`${animations[direction]} ${className}`} 
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      {children}
    </div>
  );
};

export const AnimatedInput = ({ enableAnimations = true, className = '', ...props }) => {
  return (
    <div className="relative group">
      <input
        className={`
          w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500
          transition-all duration-200
          ${enableAnimations ? 'focus:ring-2 focus:ring-blue-500/20 group-hover:border-gray-600' : ''}
          ${className}
        `}
        {...props}
      />
      {enableAnimations && (
        <div className="absolute inset-0 rounded-lg pointer-events-none border border-blue-500 opacity-0 scale-95 group-focus-within:opacity-0 transition-all duration-300" />
      )}
    </div>
  );
};
