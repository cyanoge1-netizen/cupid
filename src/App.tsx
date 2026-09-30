import { bn } from './i18n/bn';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold text-emerald-700">{bn.appName}</h1>
      <p className="text-gray-600 mt-2 text-base">{bn.appTagline}</p>
    </div>
  );
}
