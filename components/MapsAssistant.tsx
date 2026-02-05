import React, { useState, useRef, useEffect } from 'react';
import { Compass, MapPin, Send, AlertTriangle, RotateCcw, ChevronDown, Flag } from 'lucide-react';
import { db } from '../services/db';
import { askGeminiPlaces, PlaceResult } from '../services/gemini';
import { resolveSecretValue } from '../services/secrets';
import { useTranslation } from '../services/useTranslation';

const MapsAssistant: React.FC = () => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [canScroll, setCanScroll] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const user = db.auth.getCurrentUser();
  const hasKey = !!user?.apiKey;
  const lang = user?.language || 'it';

  const handleSearch = async () => {
    if (!query.trim() || !hasKey || !user) return;
    setLoading(true);
    setAnswer(null);
    setPlaces([]);

    let lat, lon;
    if (navigator.geolocation) {
        let shouldTry = true;
        if (navigator.permissions?.query) {
            try {
                const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
                if (status.state === 'denied') {
                    shouldTry = false;
                }
            } catch {
                // ignore permission API errors
            }
        }
        if (shouldTry) {
            try {
                const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
                });
                lat = pos.coords.latitude;
                lon = pos.coords.longitude;
            } catch {
                // ignore geolocation failures; AI Scout works without location
            }
        }
    }

    // Passed 'lang' to the service
    const apiKey = await resolveSecretValue(user.apiKey);
    if (!apiKey) {
        setLoading(false);
        return;
    }

    const result = await askGeminiPlaces(query, apiKey, lang, lat, lon);
    setAnswer(result.answer);
    setPlaces(result.places);
    setLoading(false);
  };

  const clear = () => {
      setAnswer(null);
      setPlaces([]);
      setQuery('');
  }

  // Check if content overflows to show arrow
  const checkScroll = () => {
      const el = scrollRef.current;
      if (!el) return;
      const isScrollable = el.scrollHeight > el.clientHeight;
      const isAtBottom = Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) < 20;
      setCanScroll(isScrollable && !isAtBottom);
  };

  useEffect(() => {
      checkScroll();
      // Re-check after slight delay to allow layout to settle
      setTimeout(checkScroll, 100);
  }, [answer, places, loading]);

  // Helper to render bold text from markdown style **text**
  const renderFormattedText = (text: string) => {
    if (!text) return null;
    // Split by **text** patterns
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="text-white font-bold">{part.slice(2, -2)}</strong>;
      }
      return <span key={index}>{part}</span>;
    });
  };

  const handleReport = () => {
      if (!answer) return;
      const subject = encodeURIComponent(t('reportAiSubject', lang));
      const body = encodeURIComponent(t('reportAiBody', lang).replace('{content}', answer.substring(0, 500)).replace('{userId}', user?.id || 'unknown'));
      const mailto = `mailto:kevin@katania.me?subject=${subject}&body=${body}`;
      if (window.katanos?.openExternal) {
          window.katanos.openExternal(mailto);
      } else {
          window.open(mailto);
      }
  };

  if (!hasKey) {
      return (
        <div className="bg-gradient-to-br from-indigo-900/40 to-slate-900/40 border border-indigo-500/20 rounded-2xl p-6 relative overflow-hidden h-full flex flex-col justify-center items-center text-center">
            <div className="bg-yellow-500/20 p-4 rounded-full mb-4 animate-pulse">
                <AlertTriangle className="text-yellow-500" size={32} />
            </div>
            <h3 className="text-xl font-bold mb-2">{t('mapAiDisabled', lang)}</h3>
            <p className="text-slate-300 text-sm mb-4">{t('mapAiDesc', lang)}</p>
        </div>
      );
  }

  return (
    <div className="bg-gradient-to-br from-indigo-900/40 to-slate-900/40 border border-indigo-500/20 rounded-2xl p-6 relative overflow-hidden group h-full flex flex-col">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Compass size={120} />
        </div>

      <div className="relative z-10 flex-1 flex flex-col min-h-0">
          <div className="flex justify-between items-center mb-4 shrink-0">
             <h3 className="text-xl font-display font-bold flex items-center gap-2 text-indigo-300">
                <Compass size={20} className="text-indigo-400" /> AI Location Scout
             </h3>
             {answer && (
                 <div className="flex gap-2">
                    <button onClick={handleReport} className="text-xs flex items-center gap-1 text-rose-400 hover:text-rose-300 px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 transition-colors" title={t('reportTooltip', lang)}>
                        <Flag size={12}/> {t('report', lang)}
                    </button>
                    <button onClick={clear} className="text-xs flex items-center gap-1 text-slate-300 hover:text-white px-2 py-1 rounded bg-white/5 hover:bg-white/10">
                        <RotateCcw size={12}/> {t('reset', lang)}
                    </button>
                 </div>
             )}
          </div>
          
          <div 
             ref={scrollRef}
             onScroll={checkScroll}
             className="flex-1 overflow-y-auto mb-4 custom-scrollbar pr-2 min-h-0 relative scroll-smooth"
          >
              {loading ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-300 animate-pulse">
                      <div className="flex gap-2">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-75"></div>
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-150"></div>
                      </div>
                      <span className="text-xs uppercase tracking-widest">{t('aiAnalysis', lang)}</span>
                  </div>
              ) : answer ? (
                  <div className="space-y-4 pb-2">
                      <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5">
                        <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{renderFormattedText(answer)}</p>
                      </div>
                      
                      {places.length > 0 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                              {places.map((place, i) => (
                                  <a key={i} href={place.uri} target="_blank" rel="noreferrer" className="flex items-start gap-3 p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all border border-white/10 hover:border-white/30 group/link h-full shadow-sm">
                                      <div className="mt-0.5 bg-indigo-500/20 p-1.5 rounded-lg shrink-0">
                                         <MapPin size={16} className="text-indigo-300"/>
                                      </div>
                                      <span className="text-sm font-bold text-white group-hover/link:text-indigo-200 transition-colors leading-tight">{place.title}</span>
                                  </a>
                              ))}
                          </div>
                      )}
                  </div>
              ) : (
                  <div className="flex flex-col justify-center items-center h-full text-slate-500 text-sm italic space-y-4">
                      <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-2">
                          <Compass size={32} className="opacity-50" />
                      </div>
                      <p>{t('mapAiExamples', lang)}</p>
                  </div>
              )}
          </div>
          
          {/* Scroll Indicator Arrow - Only visible when content overflows and user is not at bottom */}
          {canScroll && (
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-bounce">
                  <div className="bg-slate-900/80 backdrop-blur rounded-full p-1.5 border border-white/10 shadow-lg text-indigo-400">
                      <ChevronDown size={20} />
                  </div>
              </div>
          )}

          <div className="flex gap-2 relative z-10 shrink-0">
            <input 
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={t('mapPlaceholder', lang)}
            className="flex-1 bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600 text-white shadow-xl"
            />
            <button 
            onClick={handleSearch}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl px-6 flex items-center justify-center transition-colors shadow-lg shadow-indigo-600/20"
            >
            <Send size={18} />
            </button>
          </div>
      </div>
    </div>
  );
};

export default MapsAssistant;
