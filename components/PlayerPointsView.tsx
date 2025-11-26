import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import TournamentPointsSummary from './TournamentPointsSummary';
import GamePointsBreakdown from './GamePointsBreakdown';

interface PlayerPointsViewProps {
  tournamentId: string;
  leagueId: string;
  playerFideId: number;
  playerName: string;
}

export default function PlayerPointsView({
  tournamentId,
  leagueId,
  playerFideId,
  playerName,
}: PlayerPointsViewProps) {
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [showGameModal, setShowGameModal] = useState(false);

  const handleGamePress = (gameId: string) => {
    setSelectedGameId(gameId);
    setShowGameModal(true);
  };

  const handleCloseModal = () => {
    setShowGameModal(false);
    setSelectedGameId(null);
  };

  return (
    <View style={styles.container}>
      <TournamentPointsSummary
        tournamentId={tournamentId}
        leagueId={leagueId}
        playerFideId={playerFideId}
        playerName={playerName}
        onGamePress={handleGamePress}
      />

      {/* Game Details Modal */}
      <Modal
        visible={showGameModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Game Details</Text>
              <TouchableOpacity onPress={handleCloseModal} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              {selectedGameId && (
                <GamePointsBreakdown
                  gameId={selectedGameId}
                  leagueId={leagueId}
                  playerFideId={playerFideId}
                />
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#94a3b8',
    fontWeight: '600',
  },
  modalBody: {
    flex: 1,
  },
});
