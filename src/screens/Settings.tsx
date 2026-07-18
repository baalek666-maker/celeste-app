import { useState } from 'react';
import type { User } from '../types';
import { logout } from '../lib/storage';
import { api } from '../lib/api';
import { toast } from '../components/Toast';
import { ProfilesScreen } from './ProfilesScreen';
import { EditBirthData } from './settings/EditBirthData';
import { LegalModal } from './settings/LegalModal';
import { FavoritesPanel } from './settings/FavoritesPanel';
import { SettingsMenu } from './settings/SettingsMenu';

/**
 * Settings — orchestrateur mince qui dispatch vers les sous-composants
 * sous src/screens/settings/. P0#5 : le fichier original faisait 709 lignes
 * et mélangeait logique RGPD, notifications, favoris, profils, éditeur de
 * données natales. Désormais chaque sous-panneau vit dans son propre fichier.
 */
export function Settings({ user, onUpdate, onPaywall }: {
  user: User;
  onUpdate: (u: User) => void;
  onPaywall?: () => void;
}) {
  const [showLegal, setShowLegal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showProfiles, setShowProfiles] = useState(false);

  const handleLogout = async () => {
    try { await api.logout(); } catch (err) { console.warn('[logout] server notify failed:', err); }
    const u = logout();
    onUpdate(u);
    toast.info('À bientôt ✨');
    window.location.reload();
  };

  if (editing && user.birthData) {
    return <EditBirthData user={user} onUpdate={onUpdate} onCancel={() => setEditing(false)} />;
  }

  if (showLegal) {
    return <LegalModal onBack={() => setShowLegal(false)} />;
  }

  if (showFavorites) {
    return <FavoritesPanel onBack={() => setShowFavorites(false)} />;
  }

  if (showProfiles) {
    return <ProfilesScreen user={user} onClose={() => setShowProfiles(false)} />;
  }

  return (
    <SettingsMenu
      user={user}
      onUpdate={onUpdate}
      onPaywall={onPaywall}
      onEditBirthData={() => setEditing(true)}
      onShowLegal={() => setShowLegal(true)}
      onShowFavorites={() => setShowFavorites(true)}
      onShowProfiles={() => setShowProfiles(true)}
      onLogout={handleLogout}
    />
  );
}
