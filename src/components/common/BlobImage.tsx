import { useState, useEffect } from 'react';

interface BlobImageProps {
  blob?: Blob;
  alt: string;
  className?: string;
  fallbackIcon?: React.ReactNode;
}

export function BlobImage({ blob, alt, className = '', fallbackIcon }: BlobImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setObjectUrl(null);
      return;
    }

    const url = URL.createObjectURL(blob);
    setObjectUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [blob]);

  if (!objectUrl) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 text-gray-400 ${className}`}>
        {fallbackIcon || null}
      </div>
    );
  }

  return (
    <img
      src={objectUrl}
      alt={alt}
      className={`object-cover ${className}`}
      loading="lazy"
    />
  );
}
