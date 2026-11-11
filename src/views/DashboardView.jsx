import { useAppStore } from '../store/useAppStore';
import { getLocalizedPlaylists } from '../config/curatedPlaylists';
import PlaylistRow from '../components/PlaylistRow';
import DailyMixRow from '../components/DailyMixRow';

export default function DashboardView() {
  const languages = useAppStore(state => state.userPreferences.languages);
  const categories = getLocalizedPlaylists(languages);

  const formatGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="pt-4 md:pt-6 px-4 md:px-8 animate-in fade-in duration-500 max-w-[1800px] mx-auto">
      <div className="mb-6 md:mb-10">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-2">{formatGreeting()}</h1>
        <div className="flex gap-2 flex-wrap items-center">
          {languages.map(lang => (
            <button
              key={lang}
              type="button"
              onClick={() => useAppStore.getState().openModal('profile')}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-full text-xs font-medium text-white capitalize border border-white/5 transition-colors cursor-pointer"
            >
              {lang}
            </button>
          ))}
          <button
            type="button"
            onClick={() => useAppStore.getState().openModal('profile')}
            className="px-3 py-1 bg-transparent hover:bg-white/10 rounded-full text-xs font-medium text-grayText hover:text-white border border-white/10 transition-colors cursor-pointer"
          >
            + Edit Languages
          </button>
        </div>
      </div>

      <DailyMixRow />

      <div className="flex flex-col gap-2 mt-4">
        {categories.map((category) => (
          <PlaylistRow key={category.id} categoryData={category} />
        ))}
      </div>
    </div>
  );
}
