import React from 'react';

function Logo({ height = 40, className = '' }) {
  return (
    <img
      src="/images/logosemfundo.png"
      alt="Orça Obra"
      className={`app-logo-img ${className}`.trim()}
      style={{ height }}
    />
  );
}

export default Logo;
