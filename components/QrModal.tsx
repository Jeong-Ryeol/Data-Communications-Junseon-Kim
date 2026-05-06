'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X } from 'lucide-react';

type Props = {
  code: string;
  onClose: () => void;
};

export default function QrModal({ code, onClose }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    const o = window.location.origin;
    setOrigin(o);
    const url = `${o}/?c=${code}`;
    QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M',
      width: 1024,
      margin: 1,
      color: { dark: '#0a0a0d', light: '#ffffff' },
    }).then(setDataUrl);
  }, [code]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 rounded-full p-2 bg-neutral-900 hover:bg-neutral-800 transition"
        aria-label="닫기"
      >
        <X className="size-5" />
      </button>
      <div
        className="bg-white rounded-3xl p-8 flex flex-col items-center gap-6 max-w-2xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {dataUrl && (
          <img
            src={dataUrl}
            alt="QR"
            className="w-full max-w-md aspect-square rounded-2xl"
          />
        )}
        <div className="text-center text-neutral-900">
          <p className="text-sm">접속 주소</p>
          <p className="text-lg font-mono">{origin || '...'}</p>
          <p className="mt-3 text-sm">코드</p>
          <p className="text-5xl font-mono tracking-[0.3em] font-semibold">{code}</p>
        </div>
      </div>
    </div>
  );
}
