import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ImagePlus, X } from 'lucide-react';

const MAX_IMAGES = 8;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default function ImageDropzone({ value, onChange, error }) {
  const [dragging, setDragging] = useState(false);
  const [previews, setPreviews] = useState([]);
  const inputRef = useRef(null);
  const dragDepth = useRef(0);

  const files = value ? Array.from(value) : [];

  useEffect(() => {
    const next = files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    setPreviews(next);
    return () => next.forEach((p) => URL.revokeObjectURL(p.url));
  }, [files.map((f) => `${f.name}:${f.size}:${f.lastModified}`).join('|')]);

  const addFiles = useCallback(
    (incoming) => {
      const accepted = [];
      for (const file of incoming) {
        if (files.length + accepted.length >= MAX_IMAGES) break;
        if (!ACCEPTED.includes(file.type)) continue;
        if (file.size > MAX_BYTES) continue;
        accepted.push(file);
      }
      if (accepted.length) {
        onChange([...files, ...accepted]);
      }
    },
    [files, onChange]
  );

  function removeAt(index) {
    onChange(files.filter((_, i) => i !== index));
  }

  function handleDrop(e) {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (e.dataTransfer.files?.length) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          e.preventDefault();
          dragDepth.current -= 1;
          if (dragDepth.current <= 0) setDragging(false);
        }}
        onDrop={handleDrop}
        className={`group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all ${
          dragging
            ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-600/10'
            : error
              ? 'border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20'
              : 'border-slate-300 bg-slate-50 hover:border-brand-400 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-brand-500 dark:hover:bg-brand-600/5'
        }`}
      >
        <motion.div
          animate={{ scale: dragging ? 1.08 : 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className={`flex h-12 w-12 items-center justify-center rounded-full ${
            dragging
              ? 'bg-brand-600 text-white'
              : 'bg-white text-brand-600 shadow-sm dark:bg-slate-900'
          }`}
        >
          <ImagePlus size={22} />
        </motion.div>

        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {dragging ? 'Drop images to upload' : 'Drag & drop images here'}
          </p>
          <p className="text-xs text-slate-500">
            or{' '}
            <span className="font-semibold text-brand-600 hover:underline">
              browse files
            </span>{' '}
            · JPEG, PNG, WEBP, GIF · max 8 · 5 MB each
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          multiple
          className="sr-only"
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
        />
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <AnimatePresence initial={false}>
            {previews.map(({ url }, index) => (
              <motion.div
                key={url}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
              >
                <img
                  src={url}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/70 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 focus:opacity-100"
                  aria-label="Remove image"
                >
                  <X size={13} />
                </button>
                {index === 0 && (
                  <span className="absolute bottom-1.5 left-1.5 rounded-md bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    Cover
                  </span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}