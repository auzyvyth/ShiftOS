
import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CarGallery = ({ images, carName }) => {
  const [selectedImage, setSelectedImage] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(false);

  const handleThumbnailSelect = (index) => {
    setSelectedImage(index);
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches) {
      setShowThumbnails(false);
    }
  };

  const handleNext = () => {
    setSelectedImage((prev) => (prev + 1) % images.length);
  };

  const handlePrev = () => {
    setSelectedImage((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className="space-y-3">
      {/* Main Image */}
      <div className="relative overflow-hidden rounded-xl shadow-xl group">
        <img
          src={images[selectedImage]}
          alt={`${carName} - Image ${selectedImage + 1}`}
          className="w-full h-[260px] sm:h-[380px] lg:h-[500px] object-cover cursor-zoom-in"
          onClick={() => setIsZoomed(true)}
        />
        
        {/* Navigation Arrows */}
        <button
          onClick={handlePrev}
          className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2 sm:p-3 rounded-full shadow-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300"
          aria-label="Previous image"
        >
          <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-gray-800" />
        </button>
        <button
          onClick={handleNext}
          className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2 sm:p-3 rounded-full shadow-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300"
          aria-label="Next image"
        >
          <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-gray-800" />
        </button>
        
        {/* Image Counter */}
        <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
          {selectedImage + 1} / {images.length}
        </div>
      </div>

      {/* Collapsible Thumbnail Strip */}
      <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-2 sm:p-3">
        <button
          type="button"
          onClick={() => setShowThumbnails((prev) => !prev)}
          className="w-full flex items-center justify-between px-2 py-1.5 text-sm font-semibold text-gray-800"
        >
          <span>{showThumbnails ? 'Hide Photos' : `Show Photos (${images.length})`}</span>
          <ChevronRight className={`w-4 h-4 transition-transform ${showThumbnails ? 'rotate-90' : ''}`} />
        </button>

        <AnimatePresence initial={false}>
          {showThumbnails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-2 max-h-48 overflow-y-auto pr-1">
                <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-7 gap-2">
                  {images.map((image, index) => (
                    <motion.div
                      key={index}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <img
                        src={image}
                        alt={`${carName} - Thumbnail ${index + 1}`}
                        className={`w-full h-14 sm:h-16 object-cover rounded-lg cursor-pointer transition-all duration-200 ${
                          selectedImage === index
                            ? 'ring-2 ring-[#1E3A8A] shadow-sm opacity-100'
                            : 'hover:ring-2 hover:ring-gray-300 opacity-70 hover:opacity-100'
                        }`}
                        onClick={() => handleThumbnailSelect(index)}
                        loading="lazy"
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Zoom Modal */}
      <AnimatePresence>
        {isZoomed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
            onClick={() => setIsZoomed(false)}
          >
            <button
              onClick={() => setIsZoomed(false)}
              className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors"
              aria-label="Close zoom view"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            
            <motion.img
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              src={images[selectedImage]}
              alt={`${carName} - Zoomed view`}
              className="max-w-full max-h-full object-contain"
            />
            
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrev();
                }}
                className="bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
                className="bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors"
                aria-label="Next image"
              >
                <ChevronRight className="w-6 h-6 text-white" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CarGallery;
