import React from 'react';
import { Modal } from 'react-native';
import LeagueSettingsScreen from '@/app/league-settings';

interface LeagueSettingsModalProps {
  visible: boolean;
  leagueId: string;
  onClose: () => void;
}

export default function LeagueSettingsModal({ visible, leagueId, onClose }: LeagueSettingsModalProps) {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <LeagueSettingsScreen leagueId={leagueId} onClose={onClose} />
    </Modal>
  );
}
