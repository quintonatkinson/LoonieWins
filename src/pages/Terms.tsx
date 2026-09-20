import LegalPage from '../components/LegalPage'
import { getTermsSections } from '../lib/legal/content'

export default function Terms() {
  return <LegalPage title="Terms of Use" sections={getTermsSections()} />
}
