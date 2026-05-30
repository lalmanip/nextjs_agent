// Airline logo utility
export const getAirlineLogo = (airlineCode: string): string => {
  // Use only SVG placeholders to avoid loading issues and infinite loops
  return createPlaceholderLogo(airlineCode);
};

// Create a simple placeholder logo
const createPlaceholderLogo = (airlineCode: string): string => {
  const colors = ['FC6603', '2563EB', '059669', 'DC2626', '7C3AED', 'EA580C'];
  const colorIndex = airlineCode.charCodeAt(0) % colors.length;
  const color = colors[colorIndex];
  
  return `data:image/svg+xml;base64,${btoa(`
    <svg width="60" height="40" xmlns="http://www.w3.org/2000/svg">
      <rect width="60" height="40" fill="#${color}" rx="4"/>
      <text x="30" y="25" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="white" text-anchor="middle">${airlineCode}</text>
    </svg>
  `)}`;
};

export const getAirlineName = (airlineCode: string): string => {
  const names: { [key: string]: string } = {
    // Indian Airlines
    'AI': 'Air India',
    '6E': 'IndiGo',
    'SG': 'SpiceJet',
    'UK': 'Vistara',
    'G8': 'Go First',
    'I5': 'AirAsia India',
    
    // International Airlines
    'EK': 'Emirates',
    'QR': 'Qatar Airways',
    'EY': 'Etihad Airways',
    'BA': 'British Airways',
    'LH': 'Lufthansa',
    'AF': 'Air France',
    'KL': 'KLM',
    'TK': 'Turkish Airlines',
    'SQ': 'Singapore Airlines',
    'CX': 'Cathay Pacific',
    'TG': 'Thai Airways',
    'MH': 'Malaysia Airlines',
    'JL': 'Japan Airlines',
    'NH': 'ANA',
    'KE': 'Korean Air',
    'OZ': 'Asiana Airlines',
    'AA': 'American Airlines',
    'DL': 'Delta Air Lines',
    'UA': 'United Airlines',
  };

  return names[airlineCode] || airlineCode;
};