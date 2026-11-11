export default function TrackCardSkeleton({ className = '' }) {
  return (
    <div className={`p-3 md:p-4 bg-[#181818] rounded-md animate-pulse ${className}`}>
      {/* Image Placeholder */}
      <div className="w-full aspect-square bg-[#282828] rounded-md mb-3 md:mb-4 shadow-sm"></div>
      
      {/* Title Placeholder */}
      <div className="h-3.5 md:h-4 bg-[#282828] rounded-sm w-3/4 mb-2"></div>
      
      {/* Subtitle Placeholder */}
      <div className="h-3 bg-[#282828] rounded-sm w-1/2"></div>
    </div>
  );
}
