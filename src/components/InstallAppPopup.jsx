import { useState } from 'react';
import { Download, Share, X, Smartphone, MoreVertical } from 'lucide-react';

export default function InstallAppPopup({
  isOpen,
  onClose,
  canPromptNatively,
  isIOS,
  onPromptInstall,
}) {
  const [showInstructions, setShowInstructions] = useState(false);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (canPromptNatively) {
      const outcome = await onPromptInstall();
      if (outcome === 'accepted') {
        setShowInstructions(false);
        onClose();
        return;
      }
      if (outcome === 'unavailable') {
        setShowInstructions(true);
      }
    } else {
      setShowInstructions(prev => !prev);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Install Hear App"
      className="fixed top-[68px] right-3 left-3 sm:left-auto sm:right-6 sm:w-[340px] z-[75] bg-[#1c1c1c]/95 backdrop-blur-lg border border-white/10 rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.75)] p-3.5 animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div className="flex items-center gap-3">
        <img
          src="/hear-icon.svg"
          alt="Hear"
          className="w-10 h-10 rounded-lg flex-shrink-0 shadow-md"
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-white leading-tight">Install Hear App</h3>
          <p className="text-[11px] text-grayText truncate mt-0.5">
            Fast launch & offline listening
          </p>
        </div>
        <button
          type="button"
          onClick={handleInstallClick}
          className="px-3.5 py-1.5 rounded-full bg-primary text-black text-xs font-bold hover:scale-105 active:scale-95 transition-transform cursor-pointer flex items-center gap-1.5 flex-shrink-0"
        >
          <Download size={13} />
          Install
        </button>
        <button
          type="button"
          onClick={() => {
            setShowInstructions(false);
            onClose();
          }}
          aria-label="Dismiss install prompt"
          className="p-1 text-grayText hover:text-white cursor-pointer flex-shrink-0"
        >
          <X size={16} />
        </button>
      </div>

      {showInstructions && (
        <div className="mt-3 pt-2.5 border-t border-white/10 text-[11px] text-white/80 space-y-1.5">
          {isIOS ? (
            <p className="flex items-start gap-2">
              <Share size={14} className="text-primary flex-shrink-0 mt-0.5" />
              <span>
                Tap the browser <strong>Share</strong> button below, then select{' '}
                <strong>Add to Home Screen</strong>.
              </span>
            </p>
          ) : (
            <p className="flex items-start gap-2">
              <Smartphone size={14} className="text-primary flex-shrink-0 mt-0.5" />
              <span>
                Tap the install icon in your address bar or open browser menu{' '}
                <MoreVertical size={11} className="inline" /> and choose{' '}
                <strong>Install Hear Music</strong>.
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

