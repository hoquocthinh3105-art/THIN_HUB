import React from 'react';

export const Logo = ({ className = "w-12 h-12" }: { className?: string }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="100" cy="100" r="95" fill="#f0fdfa" />
    
    {/* Roof */}
    <path d="M30 50 L100 15 L170 50 Z" fill="#0f766e" />
    <path d="M45 50 L100 22 L155 50 Z" fill="#14b8a6" />
    
    {/* Window */}
    <rect x="92" y="30" width="6" height="6" fill="#fff" />
    <rect x="102" y="30" width="6" height="6" fill="#fff" />
    <rect x="92" y="40" width="6" height="6" fill="#fff" />
    <rect x="102" y="40" width="6" height="6" fill="#fff" />

    {/* T Horizontal */}
    <path d="M25 55 L175 55 L175 75 L155 75 L155 65 L45 65 L45 75 L25 75 Z" fill="#0f766e" />
    
    {/* H Pillars */}
    <path d="M35 80 L65 80 L65 170 L35 170 Z" fill="#38bdf8" />
    <path d="M35 80 L45 80 L45 170 L35 170 Z" fill="#0284c7" />
    <path d="M135 80 L165 80 L165 170 L135 170 Z" fill="#38bdf8" />
    <path d="M155 80 L165 80 L165 170 L155 170 Z" fill="#0284c7" />

    {/* T Vertical */}
    <rect x="85" y="65" width="30" height="115" fill="#0f766e" />
    <path d="M70 180 L130 180 L115 160 L85 160 Z" fill="#0f766e" />

    {/* Flame */}
    <path d="M100 105 C80 105 85 65 100 50 C115 65 120 105 100 105 Z" fill="#f59e0b" />
    <path d="M100 100 C90 100 95 75 100 60 C105 75 110 100 100 100 Z" fill="#fbbf24" />

    {/* Book Base (Dark Teal) */}
    <path d="M45 145 Q100 175 155 145 L155 155 Q100 185 45 155 Z" fill="#0f766e" />

    {/* Book Pages */}
    {/* Left Page Gold */}
    <path d="M45 115 Q75 135 100 115 L100 155 Q75 175 45 155 Z" fill="#fbbf24" />
    {/* Left Page Blue */}
    <path d="M50 118 Q75 133 97 118 L97 150 Q75 165 50 150 Z" fill="#38bdf8" />
    
    {/* Right Page Gold */}
    <path d="M155 115 Q125 135 100 115 L100 155 Q125 175 155 155 Z" fill="#fbbf24" />
    {/* Right Page Blue */}
    <path d="M150 118 Q125 133 103 118 L103 150 Q125 165 150 150 Z" fill="#38bdf8" />
  </svg>
);
