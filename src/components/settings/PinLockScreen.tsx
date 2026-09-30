import { useState, useEffect } from 'react';
import { bn } from '../../i18n/bn';
import { Lock, Unlock, AlertTriangle } from 'lucide-react';

const FAILED_ATTEMPTS_KEY = 'ghotkali_pin_failed_attempts';
const LOCKOUT_UNTIL_KEY = 'ghotkali_pin_lockout_until';
const LOCKOUT_DURATION_MS = 30000; // 30 seconds

interface PinLockScreenProps {
  onUnlock: (pin: string) => Promise<boolean>;
}

export function PinLockScreen({ onUnlock }: PinLockScreenProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  // Check lockout state on mount and run countdown interval
  useEffect(() => {
    const checkLockout = () => {
      const storedUntil = localStorage.getItem(LOCKOUT_UNTIL_KEY);
      if (storedUntil) {
        const remainingMs = Number(storedUntil) - Date.now();
        if (remainingMs > 0) {
          const secs = Math.ceil(remainingMs / 1000);
          setLockoutSeconds(secs);
          setError(bn.settings.pinLockout.replace('{seconds}', String(secs)));
          return;
        } else {
          localStorage.removeItem(LOCKOUT_UNTIL_KEY);
          setLockoutSeconds(0);
        }
      }
    };

    checkLockout();

    const interval = setInterval(() => {
      const storedUntil = localStorage.getItem(LOCKOUT_UNTIL_KEY);
      if (storedUntil) {
        const remainingMs = Number(storedUntil) - Date.now();
        if (remainingMs > 0) {
          const secs = Math.ceil(remainingMs / 1000);
          setLockoutSeconds(secs);
          setError(bn.settings.pinLockout.replace('{seconds}', String(secs)));
        } else {
          localStorage.removeItem(LOCKOUT_UNTIL_KEY);
          setLockoutSeconds(0);
          setError('');
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleDigit = async (d: string) => {
    if (lockoutSeconds > 0 || isVerifying) return;
    if (pin.length >= 4) return;
    const newPin = pin + d;
    setPin(newPin);
    setError('');

    if (newPin.length === 4) {
      setIsVerifying(true);
      const success = await onUnlock(newPin);
      setIsVerifying(false);
      if (success) {
        localStorage.removeItem(FAILED_ATTEMPTS_KEY);
        localStorage.removeItem(LOCKOUT_UNTIL_KEY);
      } else {
        const currentFailed = Number(localStorage.getItem(FAILED_ATTEMPTS_KEY) || '0') + 1;
        localStorage.setItem(FAILED_ATTEMPTS_KEY, String(currentFailed));

        if (currentFailed >= 5) {
          const lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
          localStorage.setItem(LOCKOUT_UNTIL_KEY, String(lockoutUntil));
          localStorage.setItem(FAILED_ATTEMPTS_KEY, '0');
          setLockoutSeconds(30);
          setError(bn.settings.pinLockout.replace('{seconds}', '30'));
        } else {
          setError(`${bn.settings.pinIncorrect} (${currentFailed}/5)`);
        }
        setPin('');
      }
    }
  };

  const handleDeleteDigit = () => {
    if (lockoutSeconds > 0 || isVerifying) return;
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
          <p className="text-sm text-red-400 font-semibold bg-red-950/60 px-3 py-1.5 rounded-lg border border-red-800 flex items-center justify-center gap-1.5">
            {lockoutSeconds > 0 ? <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" /> : null}
            <span>{error}</span>
          </p>
        ) : null}

        {/* Numeric keypad (min 48px touch targets) */}
        <div className="grid grid-cols-3 gap-4 w-full pt-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={lockoutSeconds > 0 || isVerifying}
              onClick={() => handleDigit(digit)}
              className={`touch-target h-14 rounded-2xl font-mono text-2xl font-bold transition flex items-center justify-center ${
                lockoutSeconds > 0 || isVerifying
                  ? 'bg-gray-850 text-gray-600 cursor-not-allowed opacity-50'
                  : 'bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-white'
              }`}
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            disabled={lockoutSeconds > 0 || isVerifying}
            onClick={() => {
              setPin('');
              setError('');
            }}
            className={`touch-target h-14 rounded-2xl text-xs font-semibold transition flex items-center justify-center ${
              lockoutSeconds > 0 || isVerifying
                ? 'bg-gray-850 text-gray-600 cursor-not-allowed opacity-50'
                : 'bg-gray-800/40 hover:bg-gray-800 active:bg-gray-700 text-gray-400'
            }`}
          >
            মুছুন
          </button>
          <button
            type="button"
            disabled={lockoutSeconds > 0 || isVerifying}
            onClick={() => handleDigit('0')}
            className={`touch-target h-14 rounded-2xl font-mono text-2xl font-bold transition flex items-center justify-center ${
              lockoutSeconds > 0 || isVerifying
                ? 'bg-gray-850 text-gray-600 cursor-not-allowed opacity-50'
                : 'bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-white'
            }`}
          >
            0
          </button>
          <button
            type="button"
            disabled={lockoutSeconds > 0 || isVerifying}
            onClick={handleDeleteDigit}
            className={`touch-target h-14 rounded-2xl text-sm font-semibold transition flex items-center justify-center ${
              lockoutSeconds > 0 || isVerifying
                ? 'bg-gray-850 text-gray-600 cursor-not-allowed opacity-50'
                : 'bg-gray-800/40 hover:bg-gray-800 active:bg-gray-700 text-gray-400'
            }`}
          >
            ⌫
          </button>
        </div>
      </div>
    </div>
  );
}
