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

export const PRIVACY_LAST_UPDATED = '2026-09-20'

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
        `${APP_NAME} aggregates publicly available contest and giveaway listings, helps you track entries, syncs an optional cloud profile, offers Smart-Fill helpers for third-party contest forms, supports referrals and optional earn/offerwall rewards, and can send push alerts about new or ending contests. Contest entry forms themselves are operated by third parties, not by us.`,
      ],
    },
    {
      heading: 'Information we process',
      paragraphs: [
        'Depending on how you use the App, we may process the following categories of information:',
      ],
      bullets: [
        'Account: email address and authentication identifiers via Supabase Auth when you create an account or sign in (email/password). Guest use without keys keeps data on-device only.',
        'Cloud profile: display name, subscription/premium flags, points, XP, level, streak, weekly entry counters, feature flags, referral code / referred-by, notification preferences, and other settings stored under your account.',
        'Smart-Fill / contact details you choose to save: name, email, phone, mailing address, city, province/state, and postal/ZIP. Stored on your device and, when signed in, synced to your cloud profile. When you trigger Smart-Fill, values may be injected into a third-party contest form; submitting shares them with that sponsor under their policy.',
        'Entry tracking: contest IDs, titles, URLs, prize estimates, status, and timestamps — on-device and, when signed in, in our entry-tracking tables.',
        'Referrals: invite/referral codes, referral pool links, and click/signup credit records when you use referral features.',
        'Earn / transactions: points ledger entries (offerwall credits, referral rewards, entry spends) associated with your account when signed in.',
        'Push notifications (mobile): Expo push tokens, platform, optional device id / app version, linked to your user id, plus notification preference toggles. Web may save preferences only; browser Web Push is not enabled.',
        'User-submitted contests (when enabled): title, URL, and submitter id for moderated listings you propose.',
        'Wins: win records associated with accounts when that feature is enabled.',
        'Contest feed metadata: public contest titles, URLs, sources, tags, prize estimates, and expiry dates. The shared feed is not your Smart-Fill profile.',
        'On-device cache: local contest vault, reported URLs, and offline copies of profile/entry data.',
        'Support messages you send us by email.',
        'Technical data (for example IP address and basic request logs processed by our hosting/database providers).',
      ],
    },
    {
      heading: 'Offerwall (when configured)',
      paragraphs: [
        'If an offerwall provider app id is configured (currently AdGem), the App may open that provider’s wall and pass a player/user identifier (your account id, or a guest id). We do not read or send your device advertising ID (IDFA/GAID) for this. Without a configured app id, earn tasks stay in a local sandbox and are not sent to AdGem. Completing offers is subject to the offerwall provider’s own terms and privacy policy.',
      ],
    },
    {
      heading: 'Information we do not currently collect',
      paragraphs: [
        'As of the date above, the App does not integrate analytics SDKs, crash reporters, social login providers, or native advertising SDKs that collect advertising IDs. Android advertising-ID permission is blocked while we are not running ads. In-app purchase billing is not live yet (upgrade UI may be stubbed). If that changes, we will update this policy and the App Store / Play Data safety disclosures before shipping.',
      ],
    },
    {
      heading: 'How we use information',
      paragraphs: ['We use information to:'],
      bullets: [
        'Operate contest discovery, caching, entry tracking, referrals, and progression (XP/streak/points).',
        'Sync your signed-in profile and Smart-Fill data across devices.',
        'Provide Smart-Fill helpers that you explicitly trigger.',
        'Deliver optional push alerts you enable (new contests / ending soon).',
        'Credit earn/referral rewards and enforce free/Pro limits.',
        'Maintain optional Pro / subscription entitlements when in-app purchases are enabled.',
        'Moderate user-submitted listings and respond to support or deletion requests.',
        'Secure the service and prevent abuse.',
      ],
    },
    {
      heading: 'Sharing',
      paragraphs: [
        'We do not sell your personal information. We share data with service providers that help us run the App, and when required by law.',
        'When you open or submit a third-party contest form (including inside an in-app browser), that site’s own privacy policy applies to anything you enter or autofill there.',
      ],
      bullets: [
        'Supabase — authentication, database, and related hosting.',
        'Expo Push (and Apple APNs / Google FCM when configured) — delivery of push notifications on mobile.',
        'Offerwall provider (e.g. AdGem) — only when an offerwall app id is configured; receives a player/user id for reward attribution.',
      ],
    },
    {
      heading: 'Retention',
      paragraphs: [
        'Device-stored data remains until you clear app storage, uninstall the App, or use Delete Account / clear data in Settings.',
        'Server-side account and profile data is retained while your account is active. After a verified deletion request, we delete associated personal data (including profile, entries, tokens, and related rows our deletion process covers) except records we must keep for legal, security, or accounting reasons (disclosed to you if applicable).',
      ],
    },
    {
      heading: 'Your choices',
      paragraphs: [
        `You can review this policy in-app (Profile → Privacy) or at ${legalUrl('privacy')}.`,
        `You can export App data from Profile → Export Data (local keys plus signed-in cloud profile/entries/transactions/referrals/wins when available), and permanently clear local data / request account deletion from Profile → Delete Account. Google Play users can also use the web deletion resource at ${legalUrl('delete-account')}.`,
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
