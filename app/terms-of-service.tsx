import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

export default function TermsOfServiceScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.text }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Terms of Service</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.lastUpdated, { color: colors.textSecondary }]}>Last Updated: December 12, 2025</Text>

        <Text style={[styles.intro, { color: colors.text }]}>
          Welcome to Fantasy Chess! By using our app, you agree to these Terms of Service.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>1. Acceptance of Terms</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          By creating an account and using Fantasy Chess, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree, please do not use the app.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>2. Description of Service</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          Fantasy Chess is a fantasy sports application for chess enthusiasts. Users can create and join fantasy chess leagues, draft real chess players onto their fantasy teams, earn points based on actual chess tournament performance, and compete with friends in private or public leagues.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>3. Account Registration</Text>
        <Text style={[styles.subheading, { color: colors.text }]}>3.1 Account Requirements</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          • You must be at least 13 years old to use Fantasy Chess{'\n'}
          • You must provide accurate and complete information{'\n'}
          • You are responsible for maintaining the security of your account{'\n'}
          • You may not share your account with others
        </Text>

        <Text style={[styles.subheading, { color: colors.text }]}>3.2 Account Termination</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          We reserve the right to suspend or terminate accounts that violate these terms or engage in fraudulent activity.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>4. Fantasy Scoring System</Text>
        <Text style={[styles.subheading, { color: colors.text }]}>4.1 How Points Are Calculated</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          Fantasy Chess uses a comprehensive scoring system that evaluates player performance across multiple dimensions. Points range from -50 to +50 per game, creating a quality-focused system where poor performance is penalized.
        </Text>

        <Text style={[styles.subheading, { color: colors.text }]}>Four Scoring Components:</Text>
        
        <Text style={[styles.componentTitle, { color: colors.text }]}>1. Rating Performance (60% weight)</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          Measures rating change from each game. Range: -10 to +10 rating points.{'\n'}
          Example: +10 rating = 60 points, 0 rating = 30 points, -10 rating = 0 points
        </Text>

        <Text style={[styles.componentTitle, { color: colors.text }]}>2. Move Quality / Sharpe Ratio (30% weight)</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          Measures consistency and accuracy using Stockfish 17 computer analysis (depth 25). Range: -1.0 to +1.0.{'\n'}
          • Positive Sharpe = more good moves than mistakes{'\n'}
          • Negative Sharpe = more mistakes than good moves{'\n'}
          • Games with insufficient data receive Sharpe = 0.0
        </Text>

        <Text style={[styles.componentTitle, { color: colors.text }]}>3. Color Advantage (6% weight)</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          • Win with Black: 6 points (hardest){'\n'}
          • Win with White: 4 points{'\n'}
          • Draw (any color): 3 points{'\n'}
          • Loss with Black: 2 points{'\n'}
          • Loss with White: 0 points
        </Text>

        <Text style={[styles.componentTitle, { color: colors.text }]}>4. Psychological Factor (4% weight)</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          Measures performance relative to recent form (last 10 games). Range: -1.0 to +1.0.
        </Text>

        <Text style={[styles.subheading, { color: colors.text }]}>Multipliers:</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          <Text style={[styles.bold, { color: colors.text }]}>Time Control Scalar:{'\n'}</Text>
          • Classical (120+ min): 1.2× multiplier{'\n'}
          • Rapid (15-60 min): 0.15× multiplier{'\n'}
          • Blitz (&lt;15 min): 0.03× multiplier{'\n\n'}
          <Text style={[styles.bold, { color: colors.text }]}>Prestige Factor (Optional):{'\n'}</Text>
          Based on tournament prize fund. Can be disabled by league commissioners.
        </Text>

        <Text style={[styles.subheading, { color: colors.text }]}>4.2 Sharpe Ratio Explained</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          The Sharpe Ratio evaluates both quality and consistency of moves:{'\n\n'}
          • Every position analyzed using Stockfish (depth 25){'\n'}
          • Centipawn changes calculated for each move{'\n'}
          • Moves with less than 10 centipawn (+/-.10) evaluation change are filtered out{'\n'}
          • Sharpe = mean(centipawn_changes) / std(centipawn_changes){'\n\n'}
          <Text style={[styles.bold, { color: colors.text }]}>Special Cases:{'\n'}</Text>
          • Games with &lt;5 analyzed moves per player: Sharpe = 0{'\n'}
          • Games with &lt;3 significant moves (after filtering): Sharpe = 0{'\n'}
          • Highly accurate draws: Often Sharpe = 0 (neutral){'\n\n'}
          <Text style={[styles.bold, { color: colors.text }]}>Interpretation:{'\n'}</Text>
          • +1.0 to +0.5: Excellent, consistent play{'\n'}
          • +0.5 to 0.0: Above average{'\n'}
          • 0.0: Average or insufficient data{'\n'}
          • 0.0 to -0.5: Below average{'\n'}
          • -0.5 to -1.0: Poor, inconsistent play
        </Text>

        <Text style={[styles.subheading, { color: colors.text }]}>4.3 Data Sources</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          • Player ratings: FIDE (International Chess Federation){'\n'}
          • Tournament results: Lichess broadcasts and official sources{'\n'}
          • Move analysis: Stockfish 17 chess engine (depth 25)
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>5. User Conduct</Text>
        <Text style={[styles.subheading, { color: colors.text }]}>5.1 Prohibited Activities</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          You may not:{'\n'}
          • Use automated bots or scripts{'\n'}
          • Manipulate or exploit the scoring system{'\n'}
          • Harass, abuse, or threaten other users{'\n'}
          • Share inappropriate content in league chats{'\n'}
          • Create multiple accounts for unfair advantages
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>6. Third-Party Content</Text>
        <Text style={[styles.subheading, { color: colors.text }]}>News Sources (Displayed on Home Page)</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          Our news feed displays article headlines and links from:{'\n\n'}
          • ChessBase (chessbase.com) - Chess news articles{'\n'}
          • Chess.com (chess.com) - Chess news articles{'\n'}
          • FIDE (fide.com) - Official chess federation news{'\n\n'}
          We display article titles and summaries with direct links to the original articles on their respective websites. We do not host the full articles or claim ownership of this content.
        </Text>

        <Text style={[styles.subheading, { color: colors.text }]}>Data Sources</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          • FIDE - Player ratings and tournament information{'\n'}
          • Lichess - Tournament broadcasts and game data{'\n'}
          • Stockfish 17 - Chess engine for move analysis (depth 25){'\n\n'}
          All third-party content remains the property of its respective owners. When you access external links, you are subject to the terms of service and privacy policies of those third-party websites.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>7. Disclaimers</Text>
        <Text style={[styles.subheading, { color: colors.text }]}>6.1 No Gambling</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          Fantasy Chess is a free entertainment service. There is no real money wagering, prizes, or gambling involved.
        </Text>

        <Text style={[styles.subheading, { color: colors.text }]}>6.2 Accuracy</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          While we strive for accuracy, we do not guarantee 100% uptime, error-free scoring, or complete tournament data.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>7. Limitation of Liability</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          Fantasy Chess is provided "as is" without warranties. We are not liable for data loss, service interruptions, or scoring errors. Maximum liability is limited to $0 (the app is free).
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>8. Privacy</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          Your privacy is important to us. Key points:{'\n'}
          • We do not sell your data{'\n'}
          • We use industry-standard security{'\n'}
          • You can request account deletion anytime
        </Text>
        <TouchableOpacity onPress={() => router.push('/privacy-policy')}>
          <Text style={[styles.link, { color: colors.primary }]}>View Privacy Policy →</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>9. Fantasy League Rules and Disclaimers</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          Fantasy Chess leagues are skill-based competitions for entertainment purposes only. No purchase is necessary to participate.{'\n\n'}
          <Text style={styles.bold}>Official Rules:</Text>{'\n'}
          • Leagues are free to join and create{'\n'}
          • Scoring is based on real chess tournament performance{'\n'}
          • No prizes, money, or rewards are awarded{'\n'}
          • Participation is voluntary and for entertainment only{'\n\n'}
          <Text style={styles.bold}>Apple Disclaimer:</Text>{'\n'}
          Apple Inc. is not a sponsor of, nor is involved in any way with, Fantasy Chess leagues or competitions. All questions, comments, or complaints regarding Fantasy Chess should be directed to nirupk@thefantasychess.com, not Apple.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>10. Changes to Terms</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          We may update these terms from time to time. Continued use after changes constitutes acceptance.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>11. Contact Information</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          For questions or support:{'\n\n'}
          Email: nirupk@thefantasychess.com{'\n'}
          Support: Use "Help & Support" in the app
        </Text>

        <Text style={[styles.footer, { color: colors.textSecondary }]}>
          By using Fantasy Chess, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
        </Text>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 28,
    color: '#fff',
    fontFamily: 'Montserrat-SemiBold',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat-SemiBold',
    color: '#fff',
  },
  placeholder: {
    width: 44,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: 'Montserrat-Regular',
    marginTop: 20,
    marginBottom: 10,
  },
  intro: {
    fontSize: 14,
    color: '#e2e8f0',
    fontFamily: 'Montserrat-Regular',
    marginBottom: 24,
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    color: '#fff',
    marginTop: 24,
    marginBottom: 12,
  },
  subheading: {
    fontSize: 15,
    fontFamily: 'Montserrat-SemiBold',
    color: '#60a5fa',
    marginTop: 16,
    marginBottom: 8,
  },
  componentTitle: {
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: '#a78bfa',
    marginTop: 12,
    marginBottom: 6,
  },
  paragraph: {
    fontSize: 14,
    color: '#cbd5e1',
    fontFamily: 'Montserrat-Regular',
    lineHeight: 22,
    marginBottom: 12,
  },
  bold: {
    fontFamily: 'Montserrat-SemiBold',
    color: '#e2e8f0',
  },
  link: {
    fontSize: 14,
    color: '#60a5fa',
    fontFamily: 'Montserrat-SemiBold',
    marginTop: 8,
    marginBottom: 12,
  },
  footer: {
    fontSize: 13,
    color: '#94a3b8',
    fontFamily: 'Montserrat-Medium',
    fontStyle: 'italic',
    marginTop: 32,
    marginBottom: 16,
    lineHeight: 20,
  },
  bottomPadding: {
    height: 40,
  },
});
