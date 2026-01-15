import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.text }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Privacy Policy</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.lastUpdated, { color: colors.textSecondary }]}>Last Updated: December 3, 2025</Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Information We Collect</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          Fantasy Chess collects and stores the following information:{'\n\n'}
          <Text style={[styles.bold, { color: colors.text }]}>• Account Information:</Text> Email address, username, and password (encrypted){'\n'}
          <Text style={[styles.bold, { color: colors.text }]}>• Profile Data:</Text> Display name, avatar selection, and user preferences{'\n'}
          <Text style={[styles.bold, { color: colors.text }]}>• League Data:</Text> Fantasy leagues you create or join, team rosters, and draft history{'\n'}
          <Text style={[styles.bold, { color: colors.text }]}>• Game Data:</Text> Chess tournament results and fantasy point calculations
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>How We Use Your Information</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          We use your information to:{'\n\n'}
          • Provide and maintain the Fantasy Chess service{'\n'}
          • Enable you to create and participate in fantasy chess leagues{'\n'}
          • Calculate fantasy points based on real chess tournament results{'\n'}
          • Send notifications about league activities (with your permission)
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Data Storage</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          All data is securely stored using Supabase (supabase.com), a trusted cloud database provider. We implement industry-standard security measures to protect your information.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Third-Party Content</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          Fantasy Chess displays news content on the home page by aggregating article headlines and links from the following third-party sources:{'\n\n'}
          <Text style={styles.bold}>• ChessBase:</Text> News articles and chess content (chessbase.com){'\n'}
          <Text style={styles.bold}>• Chess.com:</Text> News articles and chess content (chess.com){'\n'}
          <Text style={styles.bold}>• FIDE:</Text> Official chess federation news and announcements (fide.com){'\n\n'}
          We display article titles and provide direct links to the original sources. When you click these links, you will be directed to third-party websites that have their own privacy policies and terms of service. We do not host or claim ownership of this content.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Data Sharing</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          We do not sell, trade, or share your personal information with third parties. Your data is only used within the Fantasy Chess application.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Rights</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          You have the right to:{'\n\n'}
          • Access your personal data{'\n'}
          • Request deletion of your account and data{'\n'}
          • Opt out of notifications{'\n'}
          • Export your data
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Push Notifications</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          We may send push notifications for:{'\n\n'}
          • League invites{'\n'}
          • Draft starting reminders{'\n'}
          • Chat messages{'\n'}
          • Tournament start notifications{'\n'}
          • Trade requests and updates{'\n\n'}
          You can disable notifications at any time in your device settings.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Data Retention</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          We retain your data for as long as your account is active. If you delete your account, we will remove your personal information within 30 days, except where required by law.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Children's Privacy</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          Our service is intended for users aged 13 and older. We do not knowingly collect information from children under 13. If you believe we have collected such information, please contact us immediately.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Security</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          We implement security measures including:{'\n\n'}
          • Encrypted password storage{'\n'}
          • Secure HTTPS connections{'\n'}
          • Regular security audits{'\n'}
          • Access controls and authentication{'\n\n'}
          However, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Third-Party Services</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          We use the following third-party services:{'\n\n'}
          <Text style={styles.bold}>• Supabase:</Text> Database and authentication{'\n'}
          <Text style={styles.bold}>• Expo:</Text> Mobile app framework and push notifications{'\n'}
          <Text style={styles.bold}>• FIDE:</Text> Chess player ratings (public data){'\n'}
          <Text style={styles.bold}>• Lichess:</Text> Tournament broadcasts (public data){'\n\n'}
          These services have their own privacy policies, which we encourage you to review.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Cookies and Tracking</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          We do not use cookies or tracking technologies for advertising purposes. We only use essential session data to keep you logged in and provide the service.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>International Users</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          Your information may be transferred to and stored on servers located in the United States. By using our service, you consent to this transfer.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Changes to This Policy</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          We may update this privacy policy from time to time. We will notify you of significant changes via:{'\n\n'}
          • In-app notifications{'\n'}
          • Email (if provided){'\n\n'}
          Continued use of the app constitutes acceptance of any changes.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Contact</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          For privacy concerns or data requests, contact us at:{'\n\n'}
          <Text style={styles.bold}>Email:</Text> nirupk@thefantasychess.com{'\n'}
          <Text style={styles.bold}>Support:</Text> Use "Help & Support" in the app
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Your California Privacy Rights</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):{'\n\n'}
          • Right to know what personal information is collected{'\n'}
          • Right to delete personal information{'\n'}
          • Right to opt-out of sale of personal information (we do not sell data){'\n'}
          • Right to non-discrimination for exercising your rights
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>GDPR Compliance (EU Users)</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          If you are in the European Union, you have rights under the General Data Protection Regulation (GDPR):{'\n\n'}
          • Right of access{'\n'}
          • Right to rectification{'\n'}
          • Right to erasure{'\n'}
          • Right to restrict processing{'\n'}
          • Right to data portability{'\n'}
          • Right to object{'\n\n'}
          To exercise these rights, contact us at the email above.
        </Text>

        <TouchableOpacity onPress={() => router.push('/terms-of-service')}>
          <Text style={styles.link}>View Terms of Service →</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
          By using Fantasy Chess, you acknowledge that you have read and understood this Privacy Policy.
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
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    color: '#fff',
    marginTop: 24,
    marginBottom: 12,
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
    marginTop: 16,
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
