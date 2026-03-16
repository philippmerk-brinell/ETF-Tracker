import AlertSettings from '../components/AlertSettings';
import NotifSettings from '../components/NotifSettings';
import AlertLog from '../components/AlertLog';

export default function Settings() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-white">Einstellungen</h1>

      <AlertSettings />
      <NotifSettings />
      <AlertLog />
    </div>
  );
}
