'use client';

import React from 'react';
import DottedMap from 'dotted-map/without-countries';
import { mapstring } from '../map/mapstring.js';

interface ProviderMapProps {
  geographicData: Record<string, number>;
}

// Simple coordinate mapping for demo purposes
// In production, you'd want a more comprehensive lookup
const locationCoords: Record<string, { lat: number; lng: number }> = {
  'North America': { lat: 40.7128, lng: -74.0060 }, // New York
  'Europe': { lat: 48.8566, lng: 2.3522 }, // Paris
  'Asia': { lat: 35.6762, lng: 139.6503 }, // Tokyo
  'South America': { lat: -23.5505, lng: -46.6333 }, // São Paulo
  'Africa': { lat: -1.2921, lng: 36.8219 }, // Nairobi
  'Oceania': { lat: -33.8688, lng: 151.2093 }, // Sydney
  'United States': { lat: 39.8283, lng: -98.5795 },
  'Canada': { lat: 56.1304, lng: -106.3468 },
  'United Kingdom': { lat: 55.3781, lng: -3.4360 },
  'Germany': { lat: 51.1657, lng: 10.4515 },
  'France': { lat: 46.2276, lng: 2.2137 },
  'Japan': { lat: 36.2048, lng: 138.2529 },
  'China': { lat: 35.8617, lng: 104.1954 },
  'Australia': { lat: -25.2744, lng: 133.7751 },
  'Brazil': { lat: -14.2350, lng: -51.9253 },
  'India': { lat: 20.5937, lng: 78.9629 },
  'Russia': { lat: 61.5240, lng: 105.3188 },
};

const ProviderMap: React.FC<ProviderMapProps> = ({ geographicData }) => {
  const map = new DottedMap({ map: JSON.parse(mapstring) });

  // Add pins for each location with providers
  Object.entries(geographicData).forEach(([location, count]) => {
    const coords = locationCoords[location];
    if (coords && count > 0) {
      const size = Math.min(0.8, 0.2 + (count / 20) * 0.6); // Scale pin size based on provider count
      
      map.addPin({
        lat: coords.lat,
        lng: coords.lng,
        svgOptions: { 
          color: '#667eea', // Cxmpute brand color
          radius: size,
        },
      });
    }
  });

  const svgMap = map.getSVG({
    radius: 0.15,
    color: '#333333',
    shape: 'circle',
    backgroundColor: '#0a0a0a', // Dark background to match theme
  });

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <img 
        src={`data:image/svg+xml;utf8,${encodeURIComponent(svgMap)}`} 
        alt="Provider Distribution Map"
        style={{ 
          width: '100%', 
          height: 'auto',
          filter: 'drop-shadow(0 4px 12px rgba(102, 126, 234, 0.2))'
        }}
      />
    </div>
  );
};

export default ProviderMap; 