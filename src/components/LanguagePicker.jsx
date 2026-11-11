import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';

const LANGUAGES = [
  { id: 'hindi', label: 'Hindi', native: 'हिंदी' },
  { id: 'english', label: 'English', native: 'English' },
  { id: 'punjabi', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { id: 'tamil', label: 'Tamil', native: 'தமிழ்' },
  { id: 'telugu', label: 'Telugu', native: 'తెలుగు' },
  { id: 'kannada', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { id: 'marathi', label: 'Marathi', native: 'मराठी' },
  { id: 'malayalam', label: 'Malayalam', native: 'മലയാളം' }
];

export default function LanguagePicker() {
  const setLanguages = useAppStore(state => state.setLanguages);
  const [selected, setSelected] = useState([]);

  const toggleLanguage = (id) => {
    setSelected(prev => 
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    );
  };

  const handleContinue = () => {
    if (selected.length > 0) {
      setLanguages(selected);
    }
  };

  return (
    <div className="min-h-dvh min-h-screen bg-dark flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="max-w-2xl w-full text-center space-y-6 sm:space-y-8">
        <div className="flex items-center justify-center gap-2.5">
          <img src="/hear-icon.svg" alt="Hear" className="w-10 h-10" />
          <span className="text-2xl font-extrabold tracking-tight text-white">Hear</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
          What music do you like?
        </h1>
        <p className="text-grayText text-sm sm:text-lg">
          Pick one or more languages to customize your Hear experience.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mt-6 sm:mt-10">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.id}
              type="button"
              onClick={() => toggleLanguage(lang.id)}
              className={`
                p-4 sm:p-6 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center gap-1.5 sm:gap-2 cursor-pointer
                ${selected.includes(lang.id) 
                  ? 'border-primary bg-primary/10 text-white shadow-[0_0_20px_rgba(29,185,84,0.2)] sm:scale-105' 
                  : 'border-[#333] hover:border-[#444] hover:bg-[#1f1f1f] text-grayText hover:text-white bg-[#181818]'
                }
              `}
            >
              <span className="text-lg sm:text-xl font-semibold">{lang.label}</span>
              <span className="text-xs sm:text-sm opacity-70">{lang.native}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleContinue}
          disabled={selected.length === 0}
          className={`
            mt-8 sm:mt-12 w-full sm:w-auto px-10 sm:px-12 py-3.5 sm:py-4 rounded-full font-bold text-base sm:text-lg transition-all duration-300
            ${selected.length > 0 
              ? 'bg-primary text-black hover:scale-105 hover:bg-[#1ed760] cursor-pointer shadow-[0_4px_14px_rgba(29,185,84,0.4)]' 
              : 'bg-[#2a2a2a] text-[#777] cursor-not-allowed'
            }
          `}
        >
          Start Listening
        </button>
      </div>
    </div>
  );
}
