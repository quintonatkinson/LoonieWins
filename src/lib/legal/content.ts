import {
  APP_NAME,
  OPERATOR_NAME,
  PRIVACY_EMAIL,
  SUPPORT_EMAIL,
  legalUrl,
} from './constants'

export interface LegalSection {
  heading: string
  paragraphs: string[]
  bullets?: string[]
}

export const PRIVACY_LAST_UPDATED = '2026-03-18'

export function getPrivacySections(): LegalSection[] {
  return [
    {
      heading: 'Who we are',
      paragraphs: [
        `This Privacy Policy describes how ${OPERATOR_NAME} (“we”, “us”) handles information in connection with the ${APP_NAME} mobile and web applications (the “App”).`,
        `Contact for privacy questions: ${PRIVACY_EMAIL}.`,
        'CUSTOMIZE: replace OPERATOR_NAME and PRIVACY_EMAIL in src/lib/legal/constants.ts (and the matching values in public/legal/*.html) before publishing.',
      ],
    },
    {
      heading: 'What the App does',
      paragraphs: [
        `${APP_NAME} aggregates publicly available contest and giveaway listings, helps you track entries, and offers optional Smart-Fill helpers so you can copy personal details into third-party contest forms. Contest entry forms themselves are operated by third parties, not by us.`,
      ],
    },
    {
      heading: 'Information we process',
      paragraphs: [
        'Depending on how you use the App, we may process the following categories of information:',
      ],
      bullets: [
        'Account information (when you sign in): email address and authentication identifiers provided by our auth provider (Supabase Auth).',
        'Profile / Smart-Fill details you choose to save: name, email, phone, mailing address, city, province/state, and postal/ZIP code. Today these values are stored primarily on your device; when cloud profiles are enabled they may also sync to our database under your account.',
        'App activity stored on your device: points balance, subscription tier selection, daily entry timestamps, entered-contest IDs, reported URLs, and a local contest cache (“vault”).',
        'Contest metadata synced to our servers: public contest titles, URLs, sources, tags, prize estimates, and expiry dates. This feed does not include your personal Smart-Fill profile.',
        'Support messages you send us by email.',
        'Technical data required to run the service (for example IP address and basic request logs processed by our hosting/database providers).',
      ],
    },
    {
      heading: 'Information we do not currently collect',
      paragraphs: [
        'As of the date above, the App does not integrate advertising SDKs, analytics SDKs, crash reporters, or social login providers. If that changes, we will update this policy and the App Store / Play Data safety disclosures before shipping.',
      ],
    },
    {
      heading: 'How we use information',
      paragraphs: ['We use information to:'],
      bullets: [
        'Operate contest discovery, caching, and entry-tracking features.',
        'Provide Smart-Fill helpers that you explicitly trigger.',
        'Maintain optional Pro / subscription entitlements when in-app purchases are enabled.',
        'Respond to support and account-deletion requests.',
        'Secure the service and prevent abuse.',
      ],
    },
    {
      heading: 'Sharing',
      paragraphs: [
        'We do not sell your personal information. We share data only with service providers that help us run the App (currently Supabase for database/auth hosting), and when required by law.',
        'When you open or submit a third-party contest form (including inside an in-app browser), that site’s own privacy policy applies to anything you enter there.',
      ],
    },
    {
      heading: 'Retention',
      paragraphs: [
        'Device-stored data remains until you clear app storage, uninstall the App, or use Delete Account / clear data in Settings.',
        'Server-side account and profile data is retained while your account is active. After a verified deletion request, we delete associated personal data except records we must keep for legal, security, or accounting reasons (disclosed to you if applicable).',
      ],
    },
    {
      heading: 'Your choices',
      paragraphs: [
        `You can review this policy in-app (Profile → Privacy) or at ${legalUrl('privacy')}.`,
        `You can export local App data from Profile → Export Data, and permanently clear local data / request account deletion from Profile → Delete Account. Google Play users can also use the web deletion resource at ${legalUrl('delete-account')}.`,
        `Support: ${SUPPORT_EMAIL}.`,
      ],
    },
    {
      heading: 'Children',
      paragraphs: [
        'The App is intended for adults. Many contests require participants to be 18+. We do not knowingly collect personal information from children. If you believe a minor has provided us personal information, contact us and we will delete it.',
      ],
    },
    {
      heading: 'International users',
      paragraphs: [
        'Servers may be located outside your province or country (including infrastructure operated by Supabase). By using the App you understand your information may be processed in those locations with appropriate safeguards offered by our providers.',
      ],
    },
    {
      heading: 'Changes',
      paragraphs: [
        'We may update this policy as the product evolves. Material changes will be reflected by updating the “Last updated” date and, where required, notifying you in the App or store listing.',
      ],
    },
  ]
}

export function getTermsSections(): LegalSection[] {
  return [
    {
      heading: 'Agreement',
      paragraphs: [
        `These Terms of Use govern your use of ${APP_NAME} operated by ${OPERATOR_NAME}. By using the App you agree to these terms. If you do not agree, do not use the App.`,
        'CUSTOMIZE: replace OPERATOR_NAME and SUPPORT_EMAIL before publishing.',
      ],
    },
    {
      heading: 'What LoonieWins provides',
      paragraphs: [
        'The App aggregates contest and giveaway information from public sources and provides tools to help you discover and enter those contests. We do not operate the third-party contests listed in the feed, award prizes, or guarantee that any listing is accurate, open, or lawful in your region.',
      ],
    },
    {
      heading: 'Eligibility',
      paragraphs: [
        'You must be old enough to enter the contests you choose (often 18+) and legally able to use the App in your jurisdiction. You are responsible for complying with each contest’s official rules, including residency and purchase requirements.',
      ],
    },
    {
      heading: 'Accounts and Smart-Fill data',
      paragraphs: [
        'If you create an account or save Smart-Fill details, you are responsible for the accuracy of that information and for keeping access to your device/account secure. You can delete local data and request account deletion at any time (see Privacy Policy).',
      ],
    },
    {
      heading: 'Subscriptions and points',
      paragraphs: [
        'Optional Pro plans and point balances may be offered. Until Apple In-App Purchase / Google Play Billing are wired, any “upgrade” UI in development builds does not charge a real store payment. When paid subscriptions ship, they will renew according to the store’s rules until cancelled in your Apple ID or Google Play account settings.',
      ],
    },
    {
      heading: 'Acceptable use',
      paragraphs: [
        'Do not misuse the App (including scraping beyond normal use, attempting to disrupt services, submitting malicious referral links, or using the App to violate contest rules or law).',
      ],
    },
    {
      heading: 'Disclaimers',
      paragraphs: [
        'The App is provided “as is” without warranties of any kind. Contest outcomes, prize fulfillment, and third-party sites are outside our control. To the fullest extent permitted by law, we are not liable for indirect or consequential damages arising from your use of the App or any contest you enter.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [`Questions: ${SUPPORT_EMAIL}.`],
    },
  ]
}

export function getSupportSections(): LegalSection[] {
  return [
    {
      heading: 'How to reach us',
      paragraphs: [
        `Email: ${SUPPORT_EMAIL}`,
        `Privacy: ${PRIVACY_EMAIL}`,
        `Operator: ${OPERATOR_NAME}`,
        'CUSTOMIZE: set SUPPORT_EMAIL / PRIVACY_EMAIL / OPERATOR_NAME in src/lib/legal/constants.ts and public/legal/support.html.',
      ],
    },
    {
      heading: 'Common requests',
      paragraphs: [
        `Privacy Policy: ${legalUrl('privacy')}`,
        `Terms of Use: ${legalUrl('terms')}`,
        `Delete account / data: use Profile → Delete Account in the App, or ${legalUrl('delete-account')}`,
      ],
    },
  ]
}
