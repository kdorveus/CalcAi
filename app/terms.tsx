import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, SafeAreaView, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from '../hooks/useTranslation';

const TermsOfServiceScreen = () => {
  const { t } = useTranslation();
  
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('common.termsOfService')}</Text>
        <View style={styles.headerRightPlaceholder} />{/* To balance the back button */}
      </View>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.lastUpdated}>{t('common.lastUpdated')}</Text>

        <Text style={styles.heading}>1. Acceptance of Terms</Text>
        <Text style={styles.paragraph}>
          Welcome to calcAI. By accessing or using our mobile application (the "Application"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use the Application. We reserve the right to modify these Terms at any time, and your continued use of the Application constitutes acceptance of any changes.
        </Text>

        <Text style={styles.heading}>2. Description of Service</Text>
        <Text style={styles.paragraph}>
          calcAI is a voice-activated calculator application that allows users to perform mathematical calculations using voice commands. The Application may include features such as:
        </Text>
        <Text style={styles.listItem}>- Voice-to-text calculation processing</Text>
        <Text style={styles.listItem}>- Calculation history (for registered users)</Text>
        <Text style={styles.listItem}>- Webhook integrations (premium feature)</Text>
        <Text style={styles.listItem}>- Cloud synchronization (for registered users)</Text>
        <Text style={styles.paragraph}>
          We reserve the right to modify, suspend, or discontinue any aspect of the Application at any time without prior notice.
        </Text>

        <Text style={styles.heading}>3. User Accounts</Text>
        <Text style={styles.paragraph}>
          To access certain features of the Application, you may be required to create an account using Google Sign-In. You are responsible for:
        </Text>
        <Text style={styles.listItem}>- Maintaining the confidentiality of your account credentials</Text>
        <Text style={styles.listItem}>- All activities that occur under your account</Text>
        <Text style={styles.listItem}>- Notifying us immediately of any unauthorized use of your account</Text>
        <Text style={styles.paragraph}>
          We reserve the right to suspend or terminate accounts that violate these Terms or engage in fraudulent, abusive, or illegal activities.
        </Text>

        <Text style={styles.heading}>4. Premium Services</Text>
        <Text style={styles.paragraph}>
          calcAI offers premium subscription services that provide access to additional features. Premium services are subject to the following terms:
        </Text>
        <Text style={styles.listItem}>- Payment is processed through Stripe, our third-party payment processor</Text>
        <Text style={styles.listItem}>- Subscription fees are non-refundable except as required by law</Text>
        <Text style={styles.listItem}>- We reserve the right to modify pricing with 30 days' notice to active subscribers</Text>
        <Text style={styles.listItem}>- Premium features may be modified or discontinued at our discretion</Text>
        <Text style={styles.paragraph}>
          For lifetime subscriptions, "lifetime" refers to the operational lifetime of the Application, not the user's lifetime.
        </Text>

        <Text style={styles.heading}>5. Acceptable Use</Text>
        <Text style={styles.paragraph}>
          You agree not to use the Application to:
        </Text>
        <Text style={styles.listItem}>- Violate any applicable laws or regulations</Text>
        <Text style={styles.listItem}>- Infringe upon the rights of others</Text>
        <Text style={styles.listItem}>- Transmit any harmful, offensive, or illegal content</Text>
        <Text style={styles.listItem}>- Attempt to gain unauthorized access to our systems or other users' accounts</Text>
        <Text style={styles.listItem}>- Use automated systems or software to extract data from the Application</Text>
        <Text style={styles.listItem}>- Interfere with or disrupt the Application's functionality</Text>
        <Text style={styles.listItem}>- Reverse engineer, decompile, or disassemble any portion of the Application</Text>

        <Text style={styles.heading}>6. Intellectual Property</Text>
        <Text style={styles.paragraph}>
          The Application and its original content, features, and functionality are owned by calcAI (a TearHappy company) and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws. You may not copy, modify, distribute, sell, or lease any part of our Application without our express written permission.
        </Text>

        <Text style={styles.heading}>7. User-Generated Content</Text>
        <Text style={styles.paragraph}>
          Any calculations, webhook configurations, or other data you create using the Application remain your property. However, by using the Application, you grant us a limited license to store, process, and transmit this data as necessary to provide the service. We do not claim ownership of your data.
        </Text>

        <Text style={styles.heading}>8. Privacy and Data Protection</Text>
        <Text style={styles.paragraph}>
          Your use of the Application is also governed by our Privacy Policy. We do not record or store your voice data. All voice processing occurs locally on your device. Please review our Privacy Policy to understand how we collect, use, and protect your information.
        </Text>

        <Text style={styles.heading}>9. Disclaimers and Limitation of Liability</Text>
        <Text style={styles.paragraph}>
          THE APPLICATION IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT:
        </Text>
        <Text style={styles.listItem}>- The Application will be uninterrupted, secure, or error-free</Text>
        <Text style={styles.listItem}>- The results obtained from the Application will be accurate or reliable</Text>
        <Text style={styles.listItem}>- Any errors in the Application will be corrected</Text>
        <Text style={styles.paragraph}>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM YOUR USE OF THE APPLICATION.
        </Text>
        <Text style={styles.paragraph}>
          calcAI is a calculator tool. While we strive for accuracy, we are not responsible for any decisions made based on calculations performed using the Application. Always verify critical calculations independently.
        </Text>

        <Text style={styles.heading}>10. Indemnification</Text>
        <Text style={styles.paragraph}>
          You agree to indemnify, defend, and hold harmless calcAI, TearHappy, and our affiliates, officers, directors, employees, and agents from any claims, liabilities, damages, losses, and expenses, including reasonable attorney's fees, arising out of or in any way connected with your access to or use of the Application or your violation of these Terms.
        </Text>

        <Text style={styles.heading}>11. Third-Party Services</Text>
        <Text style={styles.paragraph}>
          The Application may integrate with third-party services (such as webhook endpoints you configure). We are not responsible for the availability, accuracy, or content of these third-party services. Your use of third-party services is at your own risk and subject to their respective terms and conditions.
        </Text>

        <Text style={styles.heading}>12. Termination</Text>
        <Text style={styles.paragraph}>
          We reserve the right to terminate or suspend your access to the Application immediately, without prior notice or liability, for any reason, including breach of these Terms. Upon termination, your right to use the Application will immediately cease. If you wish to terminate your account, you may contact us at support@tearhappy.com.
        </Text>

        <Text style={styles.heading}>13. Governing Law and Dispute Resolution</Text>
        <Text style={styles.paragraph}>
          These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which TearHappy operates, without regard to its conflict of law provisions. Any disputes arising from these Terms or your use of the Application shall be resolved through binding arbitration, except where prohibited by law.
        </Text>

        <Text style={styles.heading}>14. Changes to Terms</Text>
        <Text style={styles.paragraph}>
          We reserve the right to modify these Terms at any time. We will notify users of any material changes by updating the "Last Updated" date at the top of this page. Your continued use of the Application after such changes constitutes your acceptance of the new Terms.
        </Text>

        <Text style={styles.heading}>15. Severability</Text>
        <Text style={styles.paragraph}>
          If any provision of these Terms is found to be unenforceable or invalid, that provision will be limited or eliminated to the minimum extent necessary so that these Terms will otherwise remain in full force and effect.
        </Text>

        <Text style={styles.heading}>16. Contact Information</Text>
        <Text style={styles.paragraph}>
          If you have any questions about these Terms of Service, please contact us at:
        </Text>
        <Text style={styles.paragraph}>calcAI (a TearHappy company)</Text>
        <Text style={styles.paragraph}>Email: support@tearhappy.com</Text>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#121212',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerRightPlaceholder: {
    width: 24 + 16,
  },
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  contentContainer: {
    padding: 20,
  },
  lastUpdated: {
    color: '#aaa',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'right',
    marginBottom: 20,
  },
  heading: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 6,
  },
  subHeading: {
    color: '#eee',
    fontSize: 17,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  paragraph: {
    color: '#ccc',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  listItem: {
    color: '#ccc',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
    marginLeft: 10,
  },
});

export default TermsOfServiceScreen;
