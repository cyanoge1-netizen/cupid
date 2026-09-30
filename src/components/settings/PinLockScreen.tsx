import { useState } from 'react';
import { bn } from '../../i18n/bn';
import { Lock, Unlock } from 'lucide-react';

interface PinLockScreenProps {
  onUnlock: (pin: string) => Promise<boolean>;
}

export function PinLockScreen({ onUnlock }: PinLockScreenProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleDigit = async (d: string) => {
    if (pin.length >= 4) return;
    const newPin = pin + d;
    setPin(newPin);
    setError('');

    if (newPin.length === 4) {
      setIsVerifying(true);
      const success = await onUnlock(newPin);
      setIsVerifying(false);
      if (!success) {
        setError(bn.settings.pinIncorrect);
        setPin('');
      }
    }
  };

  const handleDeleteDigit = () => {
    setPin((prev) => prev.slice(0, -1));
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-xs w-full flex flex-col items-center text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-emerald-900/60 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-2">
          {isVerifying ? (
            <Unlock className="w-8 h-8 animate-pulse text-emerald-300" />
          ) : (
            <Lock className="w-8 h-8" />
          )}
        </div>

        <div>
          <h1 className="text-2xl font-bold">{bn.appName}</h1>
          <p className="text-sm text-gray-400 mt-1">{bn.settings.enterPin}</p>
        </div>

        {/* 4 PIN Dots */}
        <div className="flex gap-4 my-4">
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pin.length > index;
            return (
              <div
                key={index}
                className={`w-4 h-4 rounded-full border-2 transition-all ${
                  isFilled
                    ? 'bg-emerald-500 border-emerald-500 scale-110'
                    : 'bg-transparent border-gray-600'
                }`}
              />
            );
          })}
        </div>

        {error ? (
          <p className="text-sm text-red-400 font-semibold bg-red-950/60 px-3 py-1.5 rounded-lg border border-red-800">
            {error}
          </p>
        ) : null}

        {/* Numeric keypad (min 48px touch targets) */}
        <div className="grid grid-cols-3 gap-4 w-full pt-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="touch-target h-14 rounded-2xl bg-gray-800 hover:bg-gray-700 active:bg-gray-600 font-mono text-2xl font-bold transition flex items-center justify-center"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setPin('');
              setError('');
            }}
            className="touch-target h-14 rounded-2xl bg-gray-800/40 hover:bg-gray-800 active:bg-gray-700 text-xs font-semibold text-gray-400 transition flex items-center justify-center"
          >
            মুছুন
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="touch-target h-14 rounded-2xl bg-gray-800 hover:bg-gray-700 active:bg-gray-600 font-mono text-2xl font-bold transition flex items-center justify-center"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleDeleteDigit}
            className="touch-target h-14 rounded-2xl bg-gray-800/40 hover:bg-gray-800 active:bg-gray-700 text-sm font-semibold text-gray-400 transition flex items-center justify-center"
          >
            ⌫
          </button>
        </div>
      </div>
    </div>
  );
}
