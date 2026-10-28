import LegalPage from '../components/LegalPage'
import { getSupportSections } from '../lib/legal/content'

export default function Support() {
  return <LegalPage title="Support" sections={getSupportSections()} />
}
