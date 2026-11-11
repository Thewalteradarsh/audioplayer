import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, Library, User, ChevronLeft, ChevronRight, Heart, Music, X, Check, WifiOff, Download } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { usePWAInstall } from '../hooks/usePWAInstall';
import BottomNav from '../components/BottomNav';
import MiniPlayer from '../components/MiniPlayer';
import InstallAppPopup from '../components/InstallAppPopup';

const ALL_LANGUAGES = [
  { id: 'hindi', label: 'Hindi' },
  { id: 'english', label: 'English' },
  { id: 'punjabi', label: 'Punjabi' },
  { id: 'tamil', label: 'Tamil' },
  { id: 'telugu', label: 'Telugu' },
  { id: 'malayalam', label: 'Malayalam' },
  { id: 'kannada', label: 'Kannada' },
  { id: 'marathi', label: 'Marathi' },
];

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { playlists, likedSongs } = useAppStore(state => state.library);
  const languages = useAppStore(state => state.userPreferences.languages);
  const { isOfflineMode, downloadedTracks } = useAppStore(state => state.offlineMode);
  const activeModal = useAppStore(state => state.ui.activeModal);
  const openModal = useAppStore(state => state.openModal);
  const closeModal = useAppStore(state => state.closeModal);

  const {
    isInstalled,
    canPromptNatively,
    isIOS,
    isDismissed,
    promptInstall,
    dismissPopup,
  } = usePWAInstall();

  const [manualInstallOpen, setManualInstallOpen] = useState(false);

  const isInstallPopupOpen = !isInstalled && (manualInstallOpen || !isDismissed);

  const handleCloseInstallPopup = () => {
    setManualInstallOpen(false);
    dismissPopup();
  };

  const toggleLanguage = (langId) => {
    const exists = languages.includes(langId);
    if (exists && languages.length === 1) return; // Keep at least 1 language active
    const updated = exists ? languages.filter(l => l !== langId) : [...languages, langId];
    useAppStore.getState().setLanguages(updated);
  };

  return (
    <div className="h-dvh h-screen flex bg-black text-white overflow-hidden font-sans relative">
      {/* Sidebar Navigation */}
      <aside className="w-64 flex-shrink-0 flex flex-col p-2 gap-2 hidden md:flex z-40">
        {/* Top Section */}
        <div className="bg-[#121212] rounded-lg p-5 flex flex-col gap-5">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="cursor-pointer flex items-center gap-3 text-left focus:outline-none group"
            aria-label="Go to Home"
          >
            <img src="/hear-icon.svg" alt="Hear Logo" className="w-10 h-10 object-contain drop-shadow-md group-hover:scale-105 transition-transform" />
            <span className="text-2xl font-extrabold tracking-tight text-white">Hear</span>
          </button>
          <nav className="flex flex-col gap-4">
            <NavItem to="/" icon={<Home size={24} />} label="Home" />
            <NavItem to="/search" icon={<Search size={24} />} label="Search" />
          </nav>
        </div>
        
        {/* Library Section */}
        <div className="bg-[#121212] rounded-lg p-5 flex-1 flex flex-col overflow-hidden">
           <NavLink to="/library" className={({ isActive }) => `flex items-center gap-4 font-bold transition-colors cursor-pointer mb-4 ${isActive ? 'text-white' : 'text-grayText hover:text-white'}`}>
             <Library size={24} />
             <span>Your Library</span>
           </NavLink>
           
           <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1 pr-1">
             <button
               type="button"
               onClick={() => {
                 if (likedSongs.length > 0) {
                   useAppStore.getState().playTrack(likedSongs[0], likedSongs);
                 } else {
                   navigate('/library');
                 }
               }}
               className="flex items-center gap-3 p-2 rounded-md hover:bg-[#1f1f1f] transition-colors text-left cursor-pointer group"
             >
               <div className="w-10 h-10 rounded bg-gradient-to-br from-indigo-700 to-purple-800 flex items-center justify-center flex-shrink-0">
                 <Heart size={16} className="fill-white text-white" />
               </div>
               <div className="min-w-0">
                 <p className="text-sm font-semibold text-white truncate">Liked Songs</p>
                 <p className="text-xs text-grayText truncate">{likedSongs.length} tracks</p>
               </div>
             </button>

             {playlists.map((playlist) => (
               <button
                 key={playlist.id}
                 type="button"
                 onClick={() => {
                   if (playlist.tracks?.length > 0) {
                     useAppStore.getState().playTrack(playlist.tracks[0], playlist.tracks);
                   } else {
                     navigate('/library');
                   }
                 }}
                 className="flex items-center gap-3 p-2 rounded-md hover:bg-[#1f1f1f] transition-colors text-left cursor-pointer group"
               >
                 <div className="w-10 h-10 rounded bg-[#282828] flex items-center justify-center flex-shrink-0 text-grayText group-hover:text-white">
                   <Music size={16} />
                 </div>
                 <div className="min-w-0">
                   <p className="text-sm font-semibold text-white truncate">{playlist.name}</p>
                   <p className="text-xs text-grayText truncate">{playlist.tracks?.length || 0} tracks</p>
                 </div>
               </button>
             ))}
           </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#121212] md:rounded-lg md:m-2 md:ml-0 overflow-hidden relative z-0">
        {/* Topbar (Desktop + Mobile) */}
        <header className="h-14 md:h-16 pt-[env(safe-area-inset-top)] flex items-center justify-between px-4 md:px-6 bg-[#121212]/90 sticky top-0 z-20 backdrop-blur-md transition-all duration-300 border-b border-white/5 md:border-b-0">
          {/* Desktop Navigation Chevrons */}
          <div className="hidden md:flex gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Go back"
              title="Back"
              className="w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 flex items-center justify-center text-grayText hover:text-white cursor-pointer transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => navigate(1)}
              aria-label="Go forward"
              title="Forward"
              className="w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 flex items-center justify-center text-grayText hover:text-white cursor-pointer transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Mobile Brand Header + Back Control */}
          <div className="flex md:hidden items-center gap-2.5">
            {location.pathname !== '/' && (
              <button
                type="button"
                onClick={() => navigate(-1)}
                aria-label="Go back"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center gap-2 cursor-pointer"
              aria-label="Go to Home"
            >
              <img src="/hear-icon.svg" alt="Hear" className="w-7 h-7" />
              <span className="text-lg font-extrabold tracking-tight text-white">Hear</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5 md:gap-3 ml-auto">
            {!isInstalled && (
              <button
                type="button"
                onClick={() => setManualInstallOpen(prev => !prev)}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white font-semibold px-3 py-1.5 rounded-full text-xs transition-colors cursor-pointer border border-white/10"
              >
                <Download size={14} className="text-primary" />
                <span className="sm:inline">Install App</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => openModal('profile')}
              aria-label="Preferences and account"
              title="Languages & Profile"
              className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-[#282828] flex items-center justify-center cursor-pointer hover:bg-[#333] text-white transition-colors"
            >
              <User size={16} />
            </button>
          </div>
        </header>

        {/* Scrollable Content View - dynamic padding to prevent clipping under players */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pb-[calc(156px+env(safe-area-inset-bottom))] md:pb-[96px]">
          <Outlet />
        </div>
      </main>

      {/* Small Floating Install App Popup */}
      <InstallAppPopup
        isOpen={isInstallPopupOpen}
        onClose={handleCloseInstallPopup}
        canPromptNatively={canPromptNatively}
        isIOS={isIOS}
        onPromptInstall={promptInstall}
      />

      {/* Strict Collision-Free Render Hierarchy */}
      <MiniPlayer />
      <BottomNav />

      {/* Profile / Language Preferences Modal */}
      {activeModal === 'profile' && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={closeModal}
        >
          <div
            className="bg-[#181818] border-t sm:border border-[#282828] w-full sm:max-w-md rounded-t-2xl sm:rounded-xl shadow-2xl p-6 relative max-h-[88dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeModal}
              aria-label="Close modal"
              className="absolute top-4 right-4 text-grayText hover:text-white cursor-pointer p-1"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
              <User size={20} className="text-primary" /> Listener Preferences
            </h2>
            <p className="text-xs text-grayText mb-5">Customize your music languages and playback stats.</p>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              <div className="bg-[#121212] border border-[#282828] rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-white">{likedSongs.length}</p>
                <p className="text-[11px] text-grayText">Liked Songs</p>
              </div>
              <div className="bg-[#121212] border border-[#282828] rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-white">{playlists.length}</p>
                <p className="text-[11px] text-grayText">Playlists</p>
              </div>
              <div className="bg-[#121212] border border-[#282828] rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-white">{downloadedTracks.length}</p>
                <p className="text-[11px] text-grayText">Offline</p>
              </div>
            </div>

            {/* Language Selector */}
            <div className="mb-6">
              <h3 className="text-sm font-bold text-white mb-2">Music Languages</h3>
              <p className="text-xs text-grayText mb-3">Select one or more languages for your Home shelves:</p>
              <div className="flex flex-wrap gap-2">
                {ALL_LANGUAGES.map((lang) => {
                  const active = languages.includes(lang.id);
                  return (
                    <button
                      key={lang.id}
                      type="button"
                      onClick={() => toggleLanguage(lang.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                        active
                          ? 'bg-primary/20 border-primary text-white'
                          : 'bg-[#121212] border-[#333] text-grayText hover:text-white'
                      }`}
                    >
                      {active && <Check size={12} className="text-primary" />}
                      {lang.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {!isInstalled && (
              <div className="mb-5 p-3 rounded-lg bg-[#121212] border border-[#282828] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white">Install Hear App</p>
                  <p className="text-[11px] text-grayText truncate">Add app shortcut for mobile & desktop</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    closeModal();
                    setManualInstallOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-full bg-primary text-black text-xs font-bold hover:scale-105 transition-transform cursor-pointer flex items-center gap-1 flex-shrink-0"
                >
                  <Download size={13} /> Install
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-[#282828]">
              <button
                type="button"
                onClick={() => useAppStore.getState().toggleOfflineMode()}
                className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  isOfflineMode ? 'bg-primary text-black' : 'bg-[#282828] text-white hover:bg-[#333]'
                }`}
              >
                <WifiOff size={14} />
                {isOfflineMode ? 'Offline Filter ON' : 'Offline Filter OFF'}
              </button>

              <button
                type="button"
                onClick={closeModal}
                className="px-5 py-2 rounded-full bg-white text-black text-xs font-bold hover:scale-105 transition-transform cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavItem({ to, icon, label }) {
  return (
    <NavLink 
      to={to} 
      className={({ isActive }) => `flex items-center gap-4 font-bold transition-colors duration-200 ${
        isActive ? 'text-white' : 'text-grayText hover:text-white'
      }`}
    >
      {({ isActive }) => (
        <>
          <div className={`${isActive ? 'text-white' : 'text-grayText'}`}>
            {icon}
          </div>
          {label}
        </>
      )}
    </NavLink>
  )
}
