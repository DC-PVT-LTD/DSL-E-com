'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Search,
  Crosshair,
  CheckCircle2,
  Navigation,
  AlertCircle,
  Building2,
  Phone,
  Mail,
  User,
  Home,
  FileText,
} from 'lucide-react';
import { ShippingAddress } from '@/types/order';

export const SRI_LANKA_PROVINCES = [
  'Western',
  'Central',
  'Southern',
  'Northern',
  'Eastern',
  'North Western',
  'North Central',
  'Uva',
  'Sabaragamuwa',
];

export const SRI_LANKA_DISTRICTS: Record<string, string[]> = {
  Western: ['Colombo', 'Gampaha', 'Kalutara'],
  Central: ['Kandy', 'Matale', 'Nuwara Eliya'],
  Southern: ['Galle', 'Matara', 'Hambantota'],
  Northern: ['Jaffna', 'Kilinochchi', 'Mannar', 'Vavuniya', 'Mullaitivu'],
  Eastern: ['Batticaloa', 'Ampara', 'Trincomalee'],
  'North Western': ['Kurunegala', 'Puttalam'],
  'North Central': ['Anuradhapura', 'Polonnaruwa'],
  Uva: ['Badulla', 'Monaragala'],
  Sabaragamuwa: ['Ratnapura', 'Kegalle'],
};

interface DeliveryLocationPickerProps {
  value: ShippingAddress;
  onChange: (address: ShippingAddress) => void;
  errors?: Record<string, string>;
}

export default function DeliveryLocationPicker({
  value,
  onChange,
  errors = {},
}: DeliveryLocationPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Default coordinate: Colombo, Sri Lanka (6.9271, 79.8612)
  const [lat, setLat] = useState<number>(value.latitude || 6.9271);
  const [lng, setLng] = useState<number>(value.longitude || 79.8612);
  const [isPinConfirmed, setIsPinConfirmed] = useState<boolean>(
    Boolean(value.latitude && value.longitude)
  );

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerInstanceRef = useRef<any>(null);

  // Initialize interactive Leaflet map (client-only)
  useEffect(() => {
    let isCancelled = false;

    async function initMap() {
      if (typeof window === 'undefined' || !mapContainerRef.current) return;
      if (mapInstanceRef.current) return; // already initialized

      try {
        const L = (await import('leaflet')).default;

        if (isCancelled || !mapContainerRef.current) return;

        // Custom SVG Pin Icon
        const customPin = L.divIcon({
          className: 'custom-leaflet-marker',
          html: `<div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;background:#0066CC;border-radius:50%;color:white;box-shadow:0 4px 14px rgba(0,102,204,0.4);border:2px solid white;cursor:grab;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 36],
        });

        const initialLat = value.latitude || 6.9271;
        const initialLng = value.longitude || 79.8612;

        const map = L.map(mapContainerRef.current, {
          center: [initialLat, initialLng],
          zoom: 14,
          scrollWheelZoom: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        const marker = L.marker([initialLat, initialLng], {
          draggable: true,
          icon: customPin,
        }).addTo(map);

        marker.on('dragend', async () => {
          const position = marker.getLatLng();
          setLat(position.lat);
          setLng(position.lng);
          setIsPinConfirmed(true);
          await reverseGeocode(position.lat, position.lng);
        });

        map.on('click', async (e: any) => {
          marker.setLatLng(e.latlng);
          setLat(e.latlng.lat);
          setLng(e.latlng.lng);
          setIsPinConfirmed(true);
          await reverseGeocode(e.latlng.lat, e.latlng.lng);
        });

        mapInstanceRef.current = map;
        markerInstanceRef.current = marker;
      } catch (err) {
        console.warn('Leaflet map initialization skipped or failed:', err);
      }
    }

    initMap();

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerInstanceRef.current = null;
      }
    };
  }, []);

  // Update map position when external coordinates change
  const updateMapPosition = (newLat: number, newLng: number) => {
    setLat(newLat);
    setLng(newLng);
    setIsPinConfirmed(true);
    if (mapInstanceRef.current && markerInstanceRef.current) {
      mapInstanceRef.current.setView([newLat, newLng], 15);
      markerInstanceRef.current.setLatLng([newLat, newLng]);
    }
  };

  // Reverse geocode coordinate to get street, city, district
  const reverseGeocode = async (latitude: number, longitude: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const street = addr.road || addr.street || addr.neighbourhood || '';
        const city = addr.city || addr.town || addr.suburb || addr.village || value.city;
        const district = addr.state_district || addr.county || value.district;
        const province = addr.state || value.province;

        onChange({
          ...value,
          formattedAddress: data.display_name,
          street: street || value.street,
          city: city || value.city,
          district: district || value.district,
          province: province || value.province,
          latitude,
          longitude,
        });
      } else {
        onChange({ ...value, latitude, longitude });
      }
    } catch {
      onChange({ ...value, latitude, longitude });
    }
  };

  // Address search via Nominatim
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    try {
      const query = encodeURIComponent(`${searchQuery}, Sri Lanka`);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${query}&countrycodes=lk&limit=5`,
        { headers: { 'Accept-Language': 'en' } }
      );
      if (!res.ok) throw new Error('Location search request failed');
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setSearchResults(data);
      } else {
        setSearchResults([]);
        setSearchError('No delivery locations found for this query. Try a nearby town or street.');
      }
    } catch (err: any) {
      setSearchError(err?.message || 'Search failed. Please enter address manually.');
    } finally {
      setIsSearching(false);
    }
  };

  const selectSearchResult = (item: { display_name: string; lat: string; lon: string }) => {
    const itemLat = parseFloat(item.lat);
    const itemLng = parseFloat(item.lon);
    updateMapPosition(itemLat, itemLng);
    setSearchResults([]);
    setSearchQuery('');
    reverseGeocode(itemLat, itemLng);
  };

  const handleLocateMe = () => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const userLat = pos.coords.latitude;
          const userLng = pos.coords.longitude;
          updateMapPosition(userLat, userLng);
          reverseGeocode(userLat, userLng);
        },
        (err) => {
          setSearchError('Could not determine your location. Please drop the pin on the map.');
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Recipient Details */}
      <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 space-y-4 shadow-sm">
        <h3 className="text-sm font-bold text-[#292525] flex items-center gap-2 border-b border-[#C6E7FF]/30 pb-3">
          <User className="w-4 h-4 text-[#0066CC]" /> Recipient Information
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="sm:col-span-2">
            <label className="font-bold text-[#292525] block mb-1">Recipient Full Name *</label>
            <div className="relative">
              <input
                type="text"
                value={value.fullName}
                onChange={(e) => onChange({ ...value, fullName: e.target.value })}
                placeholder="e.g. Kavindu Senanayake"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#C6E7FF]/40 bg-[#FFFDF0]/50 text-[#292525]"
              />
              <User className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
            </div>
            {errors.fullName && <p className="text-rose-600 mt-1">{errors.fullName}</p>}
          </div>

          <div>
            <label className="font-bold text-[#292525] block mb-1">Mobile Phone (Delivery Contact) *</label>
            <div className="relative">
              <input
                type="tel"
                value={value.phone}
                onChange={(e) => onChange({ ...value, phone: e.target.value })}
                placeholder="+94 77 123 4567"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#C6E7FF]/40 bg-[#FFFDF0]/50 text-[#292525]"
              />
              <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
            </div>
            {errors.phone && <p className="text-rose-600 mt-1">{errors.phone}</p>}
          </div>

          <div>
            <label className="font-bold text-[#292525] block mb-1">Email (Order Updates) *</label>
            <div className="relative">
              <input
                type="email"
                value={value.email}
                onChange={(e) => onChange({ ...value, email: e.target.value })}
                placeholder="kavindu@example.lk"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#C6E7FF]/40 bg-[#FFFDF0]/50 text-[#292525]"
              />
              <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
            </div>
            {errors.email && <p className="text-rose-600 mt-1">{errors.email}</p>}
          </div>
        </div>
      </div>

      {/* 2. Map & Precise Location Selection (Phase 8) */}
      <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#C6E7FF]/30 pb-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#0066CC]" />
            <div>
              <h3 className="text-sm font-bold text-[#292525]">Precise Delivery Point (Map)</h3>
              <p className="text-[11px] text-[#292525]/60">
                Search or drag the pin to your exact building, gate, or entrance.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLocateMe}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#C6E7FF]/50 text-[#0066CC] hover:bg-[#C6E7FF] transition-colors"
          >
            <Crosshair className="w-3.5 h-3.5" /> Locate Me
          </button>
        </div>

        {/* Place Search Bar */}
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
                placeholder="Search town, landmark, road or area in Sri Lanka..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:border-[#0066CC] text-xs bg-[#FFFDF0]/40"
              />
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
            </div>
            <button
              type="button"
              onClick={() => handleSearch()}
              disabled={isSearching}
              className="px-4 py-2.5 bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              {isSearching ? 'Searching...' : 'Search Place'}
            </button>
          </div>

          {/* Autocomplete Search Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-white rounded-2xl border border-stone-200 shadow-lg max-h-56 overflow-y-auto divide-y divide-stone-100">
              {searchResults.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => selectSearchResult(item)}
                  className="w-full text-left p-3 text-xs hover:bg-[#C6E7FF]/20 flex items-start gap-2 text-[#292525]"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#0066CC] shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{item.display_name}</span>
                </button>
              ))}
            </div>
          )}

          {searchError && (
            <p className="text-[11px] text-amber-700 flex items-center gap-1 mt-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> {searchError}
            </p>
          )}
        </div>

        {/* Leaflet Map Preview Container */}
        <div className="relative rounded-2xl overflow-hidden border border-[#C6E7FF]/80 shadow-inner h-64 sm:h-72 bg-stone-100">
          <div ref={mapContainerRef} className="w-full h-full z-10" />

          {/* Coordinate Confirmation Badge */}
          <div className="absolute bottom-3 left-3 right-3 z-20 bg-white/95 backdrop-blur-xs rounded-xl p-2.5 shadow-md flex items-center justify-between text-xs border border-[#C6E7FF]/60">
            <div className="flex items-center gap-2">
              <CheckCircle2 className={`w-4 h-4 ${isPinConfirmed ? 'text-emerald-600' : 'text-stone-400'}`} />
              <div>
                <strong className="block text-[11px] text-[#292525]">
                  {isPinConfirmed ? 'Confirmed Delivery Coordinates' : 'Default Pin Position'}
                </strong>
                <span className="text-[10px] text-stone-500 font-mono">
                  Lat: {lat.toFixed(5)}, Lng: {lng.toFixed(5)}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Pin Set
            </span>
          </div>
        </div>
      </div>

      {/* 3. Structured Street Address & Delivery Notes */}
      <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 space-y-4 shadow-sm">
        <h3 className="text-sm font-bold text-[#292525] flex items-center gap-2 border-b border-[#C6E7FF]/30 pb-3">
          <Home className="w-4 h-4 text-[#0066CC]" /> Structured Delivery Address
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="font-bold text-[#292525] block mb-1">Province *</label>
            <select
              value={value.province || 'Western'}
              onChange={(e) => {
                const prov = e.target.value;
                const availableDistricts = SRI_LANKA_DISTRICTS[prov] || [];
                onChange({
                  ...value,
                  province: prov,
                  district: availableDistricts[0] || value.district,
                });
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:border-[#0066CC] bg-[#FFFDF0]/50 text-[#292525]"
            >
              {SRI_LANKA_PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p} Province
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-[#292525] block mb-1">District in Sri Lanka *</label>
            <select
              value={value.district}
              onChange={(e) => onChange({ ...value, district: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:border-[#0066CC] bg-[#FFFDF0]/50 text-[#292525]"
            >
              {(SRI_LANKA_DISTRICTS[value.province || 'Western'] || []).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            {errors.district && <p className="text-rose-600 mt-1">{errors.district}</p>}
          </div>

          <div>
            <label className="font-bold text-[#292525] block mb-1">City or Locality *</label>
            <input
              type="text"
              value={value.city}
              onChange={(e) => onChange({ ...value, city: e.target.value })}
              placeholder="e.g. Kollupitiya, Kandy City"
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:border-[#0066CC] bg-[#FFFDF0]/50 text-[#292525]"
            />
            {errors.city && <p className="text-rose-600 mt-1">{errors.city}</p>}
          </div>

          <div>
            <label className="font-bold text-[#292525] block mb-1">House or Building Number</label>
            <input
              type="text"
              value={value.buildingNo || ''}
              onChange={(e) => onChange({ ...value, buildingNo: e.target.value })}
              placeholder="e.g. No. 42/3 or Level 4"
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:border-[#0066CC] bg-[#FFFDF0]/50 text-[#292525]"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="font-bold text-[#292525] block mb-1">Street Address or Road *</label>
            <input
              type="text"
              value={value.addressLine1}
              onChange={(e) => onChange({ ...value, addressLine1: e.target.value })}
              placeholder="e.g. Galle Road, Temple Road"
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:border-[#0066CC] bg-[#FFFDF0]/50 text-[#292525]"
            />
            {errors.addressLine1 && <p className="text-rose-600 mt-1">{errors.addressLine1}</p>}
          </div>

          <div>
            <label className="font-bold text-[#292525] block mb-1">Nearby Landmark (Optional)</label>
            <input
              type="text"
              value={value.landmark || ''}
              onChange={(e) => onChange({ ...value, landmark: e.target.value })}
              placeholder="e.g. Opposite Supermarket / Near Clock Tower"
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:border-[#0066CC] bg-[#FFFDF0]/50 text-[#292525]"
            />
          </div>

          <div>
            <label className="font-bold text-[#292525] block mb-1">Postal Code (Optional)</label>
            <input
              type="text"
              value={value.postalCode || ''}
              onChange={(e) => onChange({ ...value, postalCode: e.target.value })}
              placeholder="e.g. 00300"
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:border-[#0066CC] bg-[#FFFDF0]/50 text-[#292525]"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="font-bold text-[#292525] block mb-1">Delivery Instructions (Optional)</label>
            <textarea
              rows={2}
              value={value.deliveryNotes || ''}
              onChange={(e) => onChange({ ...value, deliveryNotes: e.target.value })}
              placeholder="e.g. Leave package at security desk or call upon arrival"
              className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:outline-none focus:border-[#0066CC] bg-[#FFFDF0]/50 text-[#292525]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

