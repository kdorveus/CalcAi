import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, SafeAreaView, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from '../hooks/useTranslation';

const PrivacyPolicyScreen = () => {
  const { t } = useTranslation();
  
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('common.privacyPolicy')}</Text>
        <View style={styles.headerRightPlaceholder} />{/* To balance the back button */}
      </View>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.lastUpdated}>{t('common.lastUpdated')}</Text>

        <Text style={styles.heading}>1. Introduction</Text>
        <Text style={styles.paragraph}>
          Welcome to calcAI ("we," "our," "us"). We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application (the "Application"). Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the application.
        </Text>

        <Text style={styles.heading}>2. Information We Collect</Text>
        <Text style={styles.paragraph}>
          We may collect information about you in a variety of ways. The information we may collect via the Application depends on the content and materials you use, and includes:
        </Text>
        <Text style={styles.subHeading}>Personal Data</Text>
        <Text style={styles.paragraph}>
          When you choose to create an account using Google Sign-In, we, through our authentication provider Supabase, collect personal information provided by Google. This typically includes your name, email address, and profile picture/avatar URL. We do not typically receive precise location data through this standard Google Sign-In process. For details on what information Google shares, please review Google's privacy policy. For details on how Supabase handles this data, please review Supabase's privacy policy. We do not collect other forms of personally identifiable information directly unless you provide it to us through support channels.
        </Text>
        <Text style={styles.subHeading}>Usage Data</Text>
        <Text style={styles.paragraph}>
          We do not currently collect detailed data about your specific calculations or granular in-app interactions within calcAI for analytics or tracking purposes. Our service providers (such as Supabase for backend operations and Netlify for web hosting) may automatically collect standard operational data, such as IP addresses, access times, device information (e.g., operating system, browser type for web), and system activity, as necessary for providing and maintaining the service, ensuring security, and for operational monitoring. This data is primarily used in an aggregated and often anonymized form.
        </Text>
        
        <Text style={styles.heading}>3. How We Use Your Information</Text>
        <Text style={styles.paragraph}>
          Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the Application to:
        </Text>
        <Text style={styles.listItem}>- Create and manage your account.</Text>
        <Text style={styles.listItem}>- Provide and improve the Application's functionality, including features such as webhook integration.</Text>
        <Text style={styles.listItem}>- Enable future features, such as calculation history and synchronization across devices (if you are logged into an account).</Text>
        <Text style={styles.listItem}>- Monitor and analyze usage and trends in an anonymized and aggregated manner to improve your experience with the Application.</Text>
        <Text style={styles.paragraph}>
          We currently use your information primarily to operate and improve the Application, including managing your account and enabling its features. In the future, we may use anonymized and aggregated information for analytical purposes to understand usage patterns and enhance the Application. We may also use information you provide, or that is generated during your use of the service, for debugging purposes to maintain and improve the stability and functionality of the Application. Should we consider using your personal information for direct advertising purposes in the future, we will update this Privacy Policy and provide you with appropriate choices regarding such use, in accordance with applicable laws.
        </Text>

        <Text style={styles.heading}>4. Disclosure of Your Information</Text>
        <Text style={styles.paragraph}>
          We may share information we have collected about you in certain situations. Your information may be disclosed as follows:
        </Text>
        <Text style={styles.subHeading}>By Law or to Protect Rights</Text>
        <Text style={styles.paragraph}>
          If we believe the release of information about you is necessary to respond to legal process, to investigate or remedy potential violations of our policies, or to protect the rights, property, and safety of others, we may share your information as permitted or required by any applicable law, rule, or regulation.
        </Text>
        <Text style={styles.subHeading}>Third-Party Service Providers</Text>
        <Text style={styles.paragraph}>
          We may share your information with third-party service providers that perform services for us or on our behalf. These include:
        </Text>
        <Text style={styles.listItem}>- Supabase: For user authentication, account management, and database services (e.g., storing your webhook configurations and future synchronized history).</Text>
        <Text style={styles.listItem}>- Netlify: For hosting the web version of our Application.</Text>
        <Text style={styles.paragraph}>
          These providers are authorized to use your information only as necessary to provide these services to us and are obligated to protect your information.
        </Text>
        <Text style={styles.subHeading}>Business Transfers</Text>
        <Text style={styles.paragraph}>
          We may share or transfer your information in connection with, or during negotiations of, any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company.
        </Text>
        
        <Text style={styles.heading}>5. Security of Your Information</Text>
        <Text style={styles.paragraph}>
          We use administrative, technical, and physical security measures to help protect your personal information. Supabase, our primary backend provider, implements industry-standard security practices. While we and our providers have taken reasonable steps to secure the personal information you provide, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.
        </Text>

        <Text style={styles.heading}>6. Policy for Children</Text>
        <Text style={styles.paragraph}>
          calcAI is not intended for use by children under the age of 13. We do not knowingly solicit information from or market to children under the age of 13. If you become aware of any data we have collected from children under age 13, please contact us immediately using the contact information provided below so we can take appropriate action.
        </Text>

        <Text style={styles.heading}>7. Your Rights</Text>
        <Text style={styles.paragraph}>
          Depending on your location, you may have certain rights regarding your personal information, such as the right to access, correct, or delete your data. You have the right to request access to, correction of, or deletion of your personal data associated with your calcAI account. To make such a request, or if you have any questions about your data, please contact us through our parent company, TearHappy, at support@tearhappy.com. We will respond to your request in accordance with applicable data protection laws.
        </Text>

        <Text style={styles.heading}>8. Changes to This Privacy Policy</Text>
        <Text style={styles.paragraph}>
          We may update this Privacy Policy from time to time. We will notify you of any changes by updating the "Last Updated" date of this Privacy Policy. You are encouraged to periodically review this Privacy Policy to stay informed of updates. Your continued use of the Application after such modifications will constitute your acknowledgment of the modified Privacy Policy and agreement to abide and be bound by that Policy.
        </Text>

        <Text style={styles.heading}>9. Contact Us</Text>
        <Text style={styles.paragraph}>
          If you have questions or comments about this Privacy Policy, please contact us at:
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
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#121212', // Slightly different from screen to stand out
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
    marginLeft: -8, // Align icon better
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerRightPlaceholder: {
    width: 24 + 16, // Match back button touchable area approx
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
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

export default PrivacyPolicyScreen; 