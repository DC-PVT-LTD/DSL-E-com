'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight, BookOpen } from 'lucide-react';
import { SchoolPack, SchoolPackConfig } from '@/types/school-pack';
import { PooSpeechBubble } from './PooSpeechBubble';
import { PooStandingCharacter } from './PooStandingCharacter';
import { GradeTierSelector } from './GradeTierSelector';
import { MatchingPackResults } from './MatchingPackResults';

export type StoryScene = 'WELCOME' | 'SELECTION' | 'RESULTS' | 'BROWSE_ALL';

interface PooSchoolPackStoryProps {
  packs: SchoolPack[];
  config: SchoolPackConfig;
  isLoading?: boolean;
}

export const PooSchoolPackStory: React.FC<PooSchoolPackStoryProps> = ({
  packs,
  config,
  isLoading = false,
}) => {
  const [scene, setScene] = useState<StoryScene>('WELCOME');
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  // Reaction triggers for Poo
  const [reactionTrigger, setReactionTrigger] = useState(0);
  const [reactionType, setReactionType] = useState<'nod' | 'smile' | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Filtered matching packs for Scene 3: exact matches first, supplemented with same grade packs to ensure 3 cards are populated
  const exactMatches = packs.filter((pack) => {
    if (!selectedGrade || !selectedTier) return true;
    const matchGrade = pack.grade.toLowerCase() === selectedGrade.toLowerCase();
    const matchTier = pack.tier.toLowerCase() === selectedTier.toLowerCase();
    return matchGrade && matchTier;
  });

  const gradeMatches = packs.filter((pack) => {
    if (!selectedGrade) return true;
    return pack.grade.toLowerCase() === selectedGrade.toLowerCase();
  });

  const matchingPacks = Array.from(new Set([...exactMatches, ...gradeMatches, ...packs])).slice(0, 3);

  // Handlers
  const handleStartStory = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setScene('SELECTION');
      setIsTransitioning(false);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' });
    }, 450);
  };

  const handleSelectGrade = (grade: string) => {
    setSelectedGrade(grade);
    setReactionType('nod');
    setReactionTrigger((prev) => prev + 1);
  };

  const handleSelectTier = (tier: string) => {
    setSelectedTier(tier);
    setReactionType('smile');
    setReactionTrigger((prev) => prev + 1);
  };

  const handleFindMyPack = () => {
    if (!selectedGrade || !selectedTier) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setScene('RESULTS');
      setIsTransitioning(false);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' });
    }, 400);
  };

  const handleBackToWelcome = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setScene('WELCOME');
      setIsTransitioning(false);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' });
    }, 400);
  };

  const handleBackToSelection = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setScene('SELECTION');
      setIsTransitioning(false);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' });
    }, 400);
  };

  const handleBrowseAll = () => {
    setScene('BROWSE_ALL');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' });
  };

  return (
    <div className="relative w-full select-none overflow-x-hidden">
      {/* Top Floating Navigation Bar */}
      <div className="absolute top-3 sm:top-4 left-0 right-0 z-30 px-3 sm:px-8 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
          <div className="inline-flex items-center gap-1.5 bg-[#FFD84D] text-[#594300] text-[10px] sm:text-[11px] font-black px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full uppercase tracking-wider shadow-md">
            <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden xs:inline">Interactive Story Experience</span>
            <span className="xs:hidden">Story Mode</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setScene(scene === 'BROWSE_ALL' ? 'WELCOME' : 'BROWSE_ALL')}
          className="pointer-events-auto text-[11px] sm:text-xs font-bold text-[#0866F5] hover:text-[#09285C] bg-white/95 backdrop-blur-md border border-white/80 hover:border-blue-300 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-md transition-all cursor-pointer"
        >
          {scene === 'BROWSE_ALL' ? '🐻 Back to Story' : '📚 All Packs'}
        </button>
      </div>

      {/* ========================================================= */}
      {/* SCENE 1: WELCOME INSIDE WARM LIBRARY                      */}
      {/* ========================================================= */}
      {scene === 'WELCOME' && (
        <>
          {/* DESKTOP (lg and above: 1024px, 1440px, 1920px) */}
          <section
            className={`relative w-full h-[calc(100vh-64px)] md:h-[calc(100vh-72px)] overflow-hidden bg-cover bg-center transition-opacity duration-500 hidden lg:block ${
              isTransitioning ? 'opacity-0 scale-[0.99]' : 'opacity-100 scale-100'
            }`}
            style={{
              backgroundImage: "url('/assets/library/scene1-poo-sitting-fullhd.jpg')",
              backgroundSize: 'cover',
              backgroundPosition: 'center bottom',
            }}
            aria-label="Scene 1: Poo welcoming you at his library desk"
          >
            {/* Subtle Ambient Light Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/10 pointer-events-none" />

            <div className="relative z-20 w-full h-full max-w-[1720px] mx-auto px-8">
              {/* Poo Speech Bubble placed in Step 1, shifted 3cm right so Poo's waving hand is not covered */}
              <div className="w-full max-w-lg absolute left-[32%] xl:left-[34%] translate-x-[3cm] top-[8%] xl:top-[11%] z-20 animate-dialog-pop">
                <PooSpeechBubble
                  title="Heyyy! 👋 I'm Poo!"
                  body="Let's find the perfect school stationery pack for you!"
                  tailPosition="bottom-left"
                  className="w-full shadow-2xl"
                >
                  <button
                    type="button"
                    data-testid="desktop-lets-go"
                    onClick={handleStartStory}
                    className="flex-1 flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 rounded-full text-sm sm:text-base font-black text-white bg-[#0866F5] hover:bg-[#0753C7] shadow-xl shadow-blue-500/35 hover:scale-[1.02] transition-all cursor-pointer"
                  >
                    <span>Let&apos;s Go</span>
                    <ArrowRight className="w-4 h-4 stroke-[3]" />
                  </button>

                  <button
                    type="button"
                    onClick={handleBrowseAll}
                    className="flex items-center justify-center gap-1.5 px-5 py-3.5 rounded-full text-xs sm:text-sm font-bold text-white bg-slate-900/60 hover:bg-slate-900/80 backdrop-blur-md border border-white/20 transition-all cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Browse All Packs</span>
                  </button>
                </PooSpeechBubble>
              </div>
            </div>
          </section>

          {/* MOBILE & TABLET PORTRAIT (< lg: 320px - 768px) */}
          <section
            className={`relative w-full min-h-[calc(100vh-64px)] bg-[#09285C] flex flex-col justify-start pb-24 sm:pb-28 transition-opacity duration-500 lg:hidden ${
              isTransitioning ? 'opacity-0 scale-[0.99]' : 'opacity-100 scale-100'
            }`}
            aria-label="Scene 1: Poo welcoming you at his library desk (Mobile)"
          >
            {/* Section A — Library & Poo Character Stage */}
            <div
              className="relative w-full h-[270px] xs:h-[300px] sm:h-[340px] overflow-hidden shrink-0 border-b-2 border-amber-400/30 shadow-lg"
              style={{
                backgroundImage: "url('/assets/library/scene1-poo-sitting-fullhd.jpg')",
                backgroundSize: 'cover',
                backgroundPosition: '18% bottom',
              }}
            >
              {/* Subtle Ambient Light Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#09285C]/90 via-transparent to-black/35 pointer-events-none" />
              {/* Golden Sunbeam Glow Accent */}
              <div className="absolute top-2 left-4 w-28 h-28 bg-amber-400/25 rounded-full blur-2xl pointer-events-none" />
            </div>

            {/* Section B & C — Dialogue & Full-Width Action Buttons */}
            <div className="relative z-20 w-full px-4 -mt-6 space-y-3.5 max-w-md mx-auto animate-dialog-pop">
              <PooSpeechBubble
                title="Heyyy! 👋 I'm Poo!"
                body="Let's find the perfect school stationery pack for you!"
                tailPosition="top-left"
                className="w-full shadow-2xl"
              >
                <div className="w-full space-y-2.5 pt-1">
                  <button
                    type="button"
                    data-testid="mobile-lets-go"
                    onClick={handleStartStory}
                    className="w-full py-3.5 px-6 rounded-full text-base font-black text-white bg-[#0866F5] hover:bg-[#0753C7] shadow-xl shadow-blue-500/35 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Let&apos;s Go</span>
                    <ArrowRight className="w-4 h-4 stroke-[3]" />
                  </button>

                  <button
                    type="button"
                    onClick={handleBrowseAll}
                    className="w-full py-2.5 px-4 rounded-full text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200/90 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4 text-slate-500" />
                    <span>Browse All Packs</span>
                  </button>
                </div>
              </PooSpeechBubble>
            </div>
          </section>
        </>
      )}

      {/* ========================================================= */}
      {/* SCENE 2: GRADE & TIER SELECTION                           */}
      {/* ========================================================= */}
      {scene === 'SELECTION' && (
        <>
          {/* DESKTOP (lg and above: 1024px, 1440px, 1920px) */}
          <section
            className={`relative w-full h-[calc(100vh-64px)] md:h-[calc(100vh-72px)] overflow-hidden hidden lg:flex items-center justify-center bg-cover bg-center transition-opacity duration-500 py-6 px-8 ${
              isTransitioning ? 'opacity-0 scale-[0.99]' : 'opacity-100 scale-100'
            }`}
            style={{
              backgroundImage: "url('/assets/library/scene2-user-library-fullhd.jpg')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
            aria-label="Scene 2: Poo guiding your grade and tier selection"
          >
            {/* Subtle Ambient Golden Sunlight Overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-950/20 via-transparent to-blue-950/20 pointer-events-none" />

            <div className="relative z-10 w-full max-w-6xl flex flex-row items-center justify-between p-8 gap-12">
              {/* Left Column: Poo walks in near the card, faces front, dialog appears */}
              <div className="w-1/2 flex flex-col items-start space-y-4">
                <div className="animate-dialog-pop w-full max-w-md">
                  <PooSpeechBubble
                    title="Ooh, exciting!"
                    emoji="🎒"
                    body="What's your grade? And which type of stationery pack would you like?"
                    tailPosition="bottom-left"
                    className="w-full shadow-2xl"
                  />
                </div>

                <div className="w-[340px] xl:w-[380px] animate-poo-walk-in pt-1 filter drop-shadow-2xl">
                  <PooStandingCharacter
                    mode="selection"
                    reactionTrigger={reactionTrigger}
                    reactionType={reactionType}
                  />
                </div>
              </div>

              {/* Right Column: Glass Selection Panel */}
              <div className="w-1/2 flex justify-end">
                <GradeTierSelector
                  grades={config.gradeGroups}
                  tiers={config.tiers}
                  selectedGrade={selectedGrade}
                  selectedTier={selectedTier}
                  onSelectGrade={handleSelectGrade}
                  onSelectTier={handleSelectTier}
                  onBack={handleBackToWelcome}
                  onSubmit={handleFindMyPack}
                />
              </div>
            </div>
          </section>

          {/* MOBILE & TABLET PORTRAIT (< lg: 320px - 768px) */}
          <section
            className={`relative w-full min-h-[calc(100vh-64px)] bg-cover bg-center transition-opacity duration-500 flex flex-col pb-28 sm:pb-32 px-3 xs:px-4 lg:hidden ${
              isTransitioning ? 'opacity-0 scale-[0.99]' : 'opacity-100 scale-100'
            }`}
            style={{
              backgroundImage: "url('/assets/library/scene2-user-library-fullhd.jpg')",
              backgroundSize: 'cover',
              backgroundPosition: 'center bottom',
            }}
            aria-label="Scene 2: Poo guiding your grade and tier selection (Mobile)"
          >
            {/* Ambient Dark Overlay */}
            <div className="absolute inset-0 bg-blue-950/35 pointer-events-none" />

            {/* Top Character Stage: Poo enters smoothly from left on shorter mobile path */}
            <div className="relative z-10 w-full h-[210px] xs:h-[240px] overflow-hidden flex items-end justify-center pt-8 shrink-0">
              <div className="w-[200px] xs:w-[230px] animate-poo-walk-in-mobile filter drop-shadow-2xl">
                <PooStandingCharacter
                  mode="selection"
                  reactionTrigger={reactionTrigger}
                  reactionType={reactionType}
                  isMobile={true}
                />
              </div>
            </div>

            {/* Dialogue & Selection Panel below character stage */}
            <div className="relative z-20 w-full max-w-md mx-auto space-y-3 -mt-2">
              <div className="animate-dialog-pop w-full">
                <PooSpeechBubble
                  title="Ooh, exciting!"
                  emoji="🎒"
                  body="What's your grade? And which type of stationery pack would you like?"
                  tailPosition="top"
                  className="w-full shadow-xl"
                />
              </div>

              <GradeTierSelector
                grades={config.gradeGroups}
                tiers={config.tiers}
                selectedGrade={selectedGrade}
                selectedTier={selectedTier}
                onSelectGrade={handleSelectGrade}
                onSelectTier={handleSelectTier}
                onBack={handleBackToWelcome}
                onSubmit={handleFindMyPack}
              />
            </div>
          </section>
        </>
      )}

      {/* ========================================================= */}
      {/* SCENE 3: HAPPY JUMPING REVEAL                             */}
      {/* ========================================================= */}
      {scene === 'RESULTS' && (
        <>
          {/* DESKTOP (lg and above: 1024px, 1440px, 1920px) */}
          <section
            className={`relative w-full h-[calc(100vh-64px)] md:h-[calc(100vh-72px)] overflow-hidden bg-cover bg-center transition-opacity duration-500 hidden lg:flex items-center justify-center px-6 lg:px-8 xl:px-12 py-3 sm:py-5 ${
              isTransitioning ? 'opacity-0 scale-[0.99]' : 'opacity-100 scale-100'
            }`}
            style={{
              backgroundImage: "url('/assets/library/scene2-user-library-fullhd.jpg')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
            aria-label="Scene 3: Matching stationery packs found by Poo"
          >
            {/* Subtle Ambient Daylight */}
            <div className="absolute inset-0 bg-blue-950/15 pointer-events-none" />

            {/* 2-Column Split Stage Layout matching Image 2 */}
            <div className="relative z-10 w-full max-w-[1560px] mx-auto h-full flex flex-row items-center justify-between gap-6 xl:gap-8 pt-8 pb-3">
              {/* LEFT COLUMN: Celebrating Poo standing on floor + Speech Bubble above */}
              <div className="w-[30%] xl:w-[28%] shrink-0 flex flex-col items-start justify-end h-full pb-8 lg:pb-12 xl:pb-14">
                {/* Dialog Bubble above Poo matching Image 2, moved little up and right */}
                <div className="w-full max-w-[340px] mb-2 sm:mb-3 translate-x-4 lg:translate-x-8 -translate-y-3 lg:-translate-y-6 animate-dialog-pop z-20">
                  <PooSpeechBubble
                    title="Yaaay! 🎉 Look what I found!"
                    body="These stationery packs are perfect for your grade!"
                    tailPosition="bottom-left"
                    className="w-full shadow-2xl"
                  />
                </div>

                {/* Celebrating jumping Poo standing on the floor */}
                <div className="w-[230px] md:w-[250px] xl:w-[280px] animate-poo-celebrate filter drop-shadow-2xl shrink-0">
                  <PooStandingCharacter mode="celebrate" />
                </div>
              </div>

              {/* RIGHT COLUMN: Big White Container Card with 3 Packs matching Image 2 */}
              <div className="w-[70%] xl:w-[72%] max-w-4xl flex items-center justify-center h-full max-h-[calc(100vh-80px)]">
                <MatchingPackResults
                  packs={matchingPacks}
                  selectedGrade={selectedGrade}
                  selectedTier={selectedTier}
                  onChangeChoices={handleBackToSelection}
                  onBrowseAll={handleBrowseAll}
                  compact={true}
                />
              </div>
            </div>
          </section>

          {/* MOBILE & TABLET PORTRAIT (< lg: 320px - 768px) */}
          <section
            className={`relative w-full min-h-[calc(100vh-64px)] bg-cover bg-center transition-opacity duration-500 flex flex-col pb-28 sm:pb-32 px-3 xs:px-4 lg:hidden ${
              isTransitioning ? 'opacity-0 scale-[0.99]' : 'opacity-100 scale-100'
            }`}
            style={{
              backgroundImage: "url('/assets/library/scene2-user-library-fullhd.jpg')",
              backgroundSize: 'cover',
              backgroundPosition: 'center bottom',
            }}
            aria-label="Scene 3: Matching stationery packs found by Poo (Mobile)"
          >
            {/* Ambient Dark Overlay */}
            <div className="absolute inset-0 bg-blue-950/35 pointer-events-none" />

            {/* Top Stage: Celebrating Poo jumping with joy */}
            <div className="relative z-10 w-full h-[180px] xs:h-[210px] overflow-hidden flex items-end justify-center pt-6 shrink-0">
              <div className="w-[170px] xs:w-[190px] animate-poo-celebrate-mobile filter drop-shadow-2xl">
                <PooStandingCharacter mode="celebrate" isMobile={true} />
              </div>
            </div>

            {/* Dialogue & Matching Pack Results Cards */}
            <div className="relative z-20 w-full max-w-md mx-auto space-y-3 -mt-2">
              <div className="animate-dialog-pop w-full">
                <PooSpeechBubble
                  title="Yaaay! 🎉 Look what I found!"
                  body="These stationery packs are perfect for your grade!"
                  tailPosition="top"
                  className="w-full shadow-xl"
                />
              </div>

              <MatchingPackResults
                packs={matchingPacks}
                selectedGrade={selectedGrade}
                selectedTier={selectedTier}
                onChangeChoices={handleBackToSelection}
                onBrowseAll={handleBrowseAll}
                compact={true}
              />
            </div>
          </section>
        </>
      )}

      {/* ========================================================= */}
      {/* SCENE 4 / MODE: BROWSE ALL CATALOG VIEW                   */}
      {/* ========================================================= */}
      {scene === 'BROWSE_ALL' && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-900 via-[#0866F5] to-blue-800 rounded-3xl p-6 sm:p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
            <div className="space-y-2 max-w-xl">
              <span className="text-[11px] font-black uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full">
                Full School Packs Catalog
              </span>
              <h2 className="text-2xl sm:text-3xl font-black">
                Explore All School Bundles
              </h2>
              <p className="text-xs sm:text-sm text-blue-100 leading-relaxed">
                Choose any pre-assembled stationery kit. You have full freedom to customize contents, swap brands, and add items.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setScene('WELCOME')}
              className="px-6 py-3.5 rounded-full text-xs sm:text-sm font-black bg-white text-[#0866F5] hover:bg-amber-300 hover:text-[#594300] transition-all shadow-lg flex items-center gap-2 cursor-pointer shrink-0"
            >
              <span>🐻 Ask Poo to Guide Me</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Catalog Results Grid */}
          <MatchingPackResults
            packs={packs}
            selectedGrade={null}
            selectedTier={null}
            onChangeChoices={() => setScene('SELECTION')}
            onBrowseAll={() => {}}
            compact={false}
          />
        </section>
      )}
    </div>
  );
};
