import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Shield, 
  ShieldAlert,
  Maximize,
  Settings2,
  Image as ImageIcon,
  Loader2
} from 'lucide-react';

// Define the structure of a Danbooru post
interface DanbooruPost {
  id: number;
  file_url?: string;
  large_file_url?: string;
  tag_string: string;
  tag_string_character: string;
  tag_string_copyright: string;
}

const SLIDE_DURATION = 6000; // 6 seconds per slide

export default function App() {
  const [images, setImages] = useState<DanbooruPost[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isSuggestive, setIsSuggestive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // Fetch images from Danbooru API
  const fetchImages = useCallback(async (suggestive: boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      const rating = suggestive ? 'q' : 'g';
      // Danbooru allows up to 2 tags for anonymous searches.
      // We use 'ai-generated' and the rating tag.
      // random=true gives us a fresh batch every time.
      const apiUrl = `https://danbooru.donmai.us/posts.json?tags=ai-generated+rating:${rating}&limit=50&random=true`;
      const response = await fetch(`/api/proxy-json?url=${encodeURIComponent(apiUrl)}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch images from the art source.');
      }

      const data: DanbooruPost[] = await response.json();
      
      // Filter out posts that might have been deleted or lack image URLs
      const validImages = data.filter(post => post.large_file_url || post.file_url);
      
      if (validImages.length === 0) {
        throw new Error('No images found for the current filters.');
      }

      setImages(validImages);
      setCurrentIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch and refetch on mode change
  useEffect(() => {
    fetchImages(isSuggestive);
  }, [isSuggestive, fetchImages]);

  // Slideshow timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isPlaying && images.length > 0) {
      interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % images.length);
      }, SLIDE_DURATION);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, images.length, currentIndex]);

  // Preload next image to prevent flickering
  useEffect(() => {
    if (images.length > 0) {
      const nextIndex = (currentIndex + 1) % images.length;
      const nextImage = images[nextIndex];
      const rawUrl = nextImage.large_file_url || nextImage.file_url;
      if (rawUrl) {
        const url = `/api/proxy-image?url=${encodeURIComponent(rawUrl)}`;
        const img = new Image();
        img.src = url;
      }
    }
  }, [currentIndex, images]);

  // Handle mouse movement to show/hide controls
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  useEffect(() => {
    handleMouseMove();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
    setIsPlaying(false);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    setIsPlaying(false);
  };

  const togglePlay = () => setIsPlaying(!isPlaying);
  
  const toggleMode = () => {
    setIsSuggestive(!isSuggestive);
    setIsPlaying(true);
  };

  const currentImage = images[currentIndex];
  const rawImageUrl = currentImage?.large_file_url || currentImage?.file_url;
  const imageUrl = rawImageUrl ? `/api/proxy-image?url=${encodeURIComponent(rawImageUrl)}` : undefined;

  // Format tags for display (take first 5 meaningful tags)
  const displayTags = currentImage?.tag_string
    .split(' ')
    .filter(t => t !== 'ai-generated' && !t.includes('rating:'))
    .slice(0, 5)
    .map(t => t.replace(/_/g, ' ')) || [];

  return (
    <div 
      className={`relative w-screen h-screen bg-black overflow-hidden select-none transition-cursor duration-500 ${!showControls && isPlaying ? 'cursor-none' : 'cursor-default'}`}
      onMouseMove={handleMouseMove}
      onClick={handleMouseMove}
    >
      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 text-white">
          <Loader2 className="w-12 h-12 animate-spin mb-4 text-white/50" />
          <p className="text-lg font-medium tracking-widest uppercase text-white/70">
            Curating Gallery...
          </p>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 text-white p-8 text-center">
          <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Connection Interrupted</h2>
          <p className="text-white/70 mb-6 max-w-md">{error}</p>
          <button 
            onClick={() => fetchImages(isSuggestive)}
            className="px-6 py-3 bg-white text-black font-semibold rounded-full hover:bg-white/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Image Display */}
      {!isLoading && imageUrl && (
        <AnimatePresence mode="wait">
          <motion.div
            key={currentImage.id}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            className="absolute inset-0 flex items-center justify-center"
          >
            {/* Blurred Background for aesthetic fill */}
            <img 
              src={imageUrl} 
              alt="Background Blur"
              className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-40 scale-110"
            />
            
            {/* Main Foreground Image */}
            <img 
              src={imageUrl} 
              alt="AI Art"
              className="relative z-10 max-w-full max-h-full object-contain drop-shadow-2xl"
            />
          </motion.div>
        </AnimatePresence>
      )}

      {/* Top Overlay - Info & Tags */}
      <div 
        className={`absolute top-0 inset-x-0 z-40 p-6 flex justify-between items-start transition-opacity duration-700 bg-gradient-to-b from-black/60 to-transparent ${showControls ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 text-white/90">
            <ImageIcon className="w-5 h-5" />
            <h1 className="text-xl font-semibold tracking-tight">AI Art Gallery</h1>
            <span className="px-2 py-1 text-xs font-bold uppercase tracking-wider bg-white/20 rounded-md backdrop-blur-md">
              {isSuggestive ? 'Suggestive' : 'SFW'}
            </span>
          </div>
          
          {displayTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {displayTags.map((tag, i) => (
                <span key={i} className="px-3 py-1 text-xs text-white/80 bg-black/40 backdrop-blur-md rounded-full border border-white/10 capitalize">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Mode Toggle */}
        <button
          onClick={toggleMode}
          className={`flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md border transition-all duration-300 ${
            isSuggestive 
              ? 'bg-rose-500/20 border-rose-500/50 text-rose-200 hover:bg-rose-500/30' 
              : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200 hover:bg-emerald-500/30'
          }`}
        >
          {isSuggestive ? <ShieldAlert className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
          <span className="text-sm font-medium">
            {isSuggestive ? 'Suggestive Mode' : 'SFW Mode'}
          </span>
        </button>
      </div>

      {/* Bottom Overlay - Controls */}
      <div 
        className={`absolute bottom-0 inset-x-0 z-40 p-8 flex flex-col items-center transition-opacity duration-700 bg-gradient-to-t from-black/80 via-black/40 to-transparent ${showControls ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="flex items-center gap-6 mb-6">
          <button 
            onClick={handlePrev}
            className="p-3 rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur-md transition-all hover:scale-110 active:scale-95"
          >
            <SkipBack className="w-6 h-6" />
          </button>
          
          <button 
            onClick={togglePlay}
            className="p-5 rounded-full bg-white text-black hover:bg-white/90 shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-all hover:scale-105 active:scale-95"
          >
            {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
          </button>
          
          <button 
            onClick={handleNext}
            className="p-3 rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur-md transition-all hover:scale-110 active:scale-95"
          >
            <SkipForward className="w-6 h-6" />
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="w-full max-w-md h-1 bg-white/20 rounded-full overflow-hidden">
          {isPlaying && (
            <motion.div 
              key={currentIndex}
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: SLIDE_DURATION / 1000, ease: "linear" }}
              className="h-full bg-white/80 rounded-full"
            />
          )}
        </div>
        
        <div className="mt-4 text-white/50 text-xs font-mono tracking-widest">
          {images.length > 0 ? `${currentIndex + 1} / ${images.length}` : '0 / 0'}
        </div>
      </div>
    </div>
  );
}
