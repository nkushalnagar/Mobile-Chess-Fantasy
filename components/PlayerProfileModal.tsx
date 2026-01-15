import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

interface PlayerProfileModalProps {
  visible: boolean;
  player: any;
  onClose: () => void;
}

const getCountryFlag = (countryCode: string): string => {
  if (!countryCode || countryCode.length < 2) return '🏳️';
  const code = countryCode.substring(0, 2).toUpperCase();
  const codePoints = code
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

const getTitleColor = (title: string | undefined): string => {
  if (!title) return '#94a3b8';
  if (title === 'GM') return '#fbbf24';
  if (title === 'IM') return '#a78bfa';
  if (title === 'FM') return '#60a5fa';
  if (title.includes('WGM') || title.includes('WIM') || title.includes('WFM') || title === 'CM') return '#34d399';
  return '#94a3b8';
};

export default function PlayerProfileModal({ visible, player, onClose }: PlayerProfileModalProps) {
  const { colors } = useTheme();

  if (!player) return null;

  const initial = player.name ? player.name.charAt(0).toUpperCase() : 'P';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <View
          style={[styles.modalContainer, { 
            backgroundColor: colors.cardBackground,
            minWidth: 380,
            maxWidth: 650,
            alignSelf: 'center'
          }]}
        >
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={onClose}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>

          <View>
            {player.profile_picture_url ? (
              <Image 
                source={{ uri: player.profile_picture_url }}
                style={styles.profilePicture}
              />
            ) : (
              <View style={[styles.profilePicturePlaceholder, { backgroundColor: colors.primary }]}>
                <Text style={styles.profilePicturePlaceholderText}>{initial}</Text>
              </View>
            )}

            <View style={styles.nameContainer}>
              <Text style={[styles.playerName, { color: colors.text }]} numberOfLines={2}>
                {player.title && (
                  <Text style={[styles.playerTitle, { color: getTitleColor(player.title) }]}>
                    {player.title}{' '}
                  </Text>
                )}
                {player.name}
              </Text>
            </View>

            <View style={styles.countryContainer}>
              <Text style={styles.countryFlag}>{getCountryFlag(player.country)}</Text>
              <Text style={[styles.countryCode, { color: colors.text }]}>{player.country}</Text>
            </View>

            <View style={[styles.ratingsContainer, { backgroundColor: colors.background }]}>
              <View style={styles.ratingItem}>
                <Text style={[styles.ratingLabel, { color: colors.textSecondary }]}>STD</Text>
                <Text style={[styles.ratingValue, { color: player.rating ? colors.primary : colors.textTertiary }]} numberOfLines={1}>
                  {player.rating || 'Inactive'}
                </Text>
              </View>
              <View style={styles.ratingItem}>
                <Text style={[styles.ratingLabel, { color: colors.textSecondary }]}>RAPID</Text>
                <Text style={[styles.ratingValue, { color: player.rapid_rating ? colors.primary : colors.textTertiary }]} numberOfLines={1}>
                  {player.rapid_rating || 'Inactive'}
                </Text>
              </View>
              <View style={styles.ratingItem}>
                <Text style={[styles.ratingLabel, { color: colors.textSecondary }]}>BLITZ</Text>
                <Text style={[styles.ratingValue, { color: player.blitz_rating ? colors.primary : colors.textTertiary }]} numberOfLines={1}>
                  {player.blitz_rating || 'Inactive'}
                </Text>
              </View>
            </View>

            <View style={styles.bioContainer}>
              <Text style={[styles.bioLabel, { color: colors.text }]}>About</Text>
              {player.bio ? (
                <>
                  <Text style={[styles.bioText, { color: colors.textSecondary }]}>{player.bio}</Text>
                  <Text style={[styles.bioSource, { color: colors.textTertiary }]}>Source: Wikipedia</Text>
                </>
              ) : (
                <Text style={[styles.bioText, { color: colors.textTertiary, fontStyle: 'italic', marginTop: 4 }]}>
                  No Bio Yet
                </Text>
              )}
            </View>

            <View style={[styles.fideContainer, { borderTopColor: colors.border }]}>
              <Text style={[styles.fideLabel, { color: colors.textSecondary }]}>FIDE ID</Text>
              <Text style={[styles.fideId, { color: colors.text }]}>{player.fide_id}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    borderRadius: 16,
    padding: 20,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
  profilePicture: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignSelf: 'center',
    marginBottom: 12,
  },
  profilePicturePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 0,
    borderStyle: 'solid',
  },
  profilePicturePlaceholderText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  nameContainer: {
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  playerName: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    flexWrap: 'wrap',
  },
  playerTitle: {
    fontWeight: 'bold',
  },
  countryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  countryFlag: {
    fontSize: 28,
  },
  countryCode: {
    fontSize: 15,
    fontWeight: '600',
  },
  ratingsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 12,
    flexWrap: 'nowrap',
  },
  ratingItem: {
    alignItems: 'center',
    minWidth: 70,
    paddingHorizontal: 4,
  },
  ratingLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  ratingValue: {
    fontSize: 17,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  bioContainer: {
    marginBottom: 12,
  },
  bioLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bioSource: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 6,
  },
  fideContainer: {
    borderTopWidth: 1,
    paddingTop: 8,
    paddingBottom: 0,
    marginBottom: 0,
  },
  fideLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  fideId: {
    fontSize: 16,
    fontWeight: '600',
  },
});
