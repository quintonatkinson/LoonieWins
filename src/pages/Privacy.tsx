import LegalPage from '../components/LegalPage'
import { getPrivacySections, PRIVACY_LAST_UPDATED } from '../lib/legal/content'

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated={PRIVACY_LAST_UPDATED}
      sections={getPrivacySections()}
    />
  )
}
