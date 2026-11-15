'use client';

import React, { useState, useEffect } from 'react';
import { schoolPackService } from '@/services/schoolPackService';
import { SchoolPack, SchoolPackConfig } from '@/types/school-pack';
import { PooSchoolPackStory } from '@/components/school-packs/PooSchoolPackStory';

export default function SchoolPacksPage() {
  const [packs, setPacks] = useState<SchoolPack[]>([]);
  const [config, setConfig] = useState<SchoolPackConfig>({
    gradeGroups: [
      'Grade 1–2',
      'Grade 3–5',
      'Grade 6–9',
      'O/L (Grade 10–11)',
      'A/L Science',
      'A/L Commerce',
      'A/L Arts',
    ],
    tiers: ['essential', 'standard', 'premium'],
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      try {
        const [configData, packsData] = await Promise.all([
          schoolPackService.getConfig(),
          schoolPackService.getPacks(),
        ]);
        if (isMounted) {
          if (configData) {
            setConfig(configData);
          }
          if (packsData && packsData.items) {
            setPacks(packsData.items);
          }
        }
      } catch (err) {
        console.warn('Failed to load school packs data:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    const unsub = schoolPackService.subscribe(() => {
      loadData();
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center space-y-4">
        <div className="w-12 h-12 border-4 border-[#0866F5] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-bold text-[#09285C]">
          Poo is getting the library ready for you...
        </p>
      </div>
    );
  }

  return (
    <main className="w-full min-h-[calc(100vh-64px)] p-0 m-0 overflow-x-hidden bg-[#0a192f]">
      <PooSchoolPackStory packs={packs} config={config} isLoading={isLoading} />
    </main>
  );
}
