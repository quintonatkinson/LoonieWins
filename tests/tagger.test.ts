import { describe, expect, it } from 'vitest'
import { autoCategorize, isPurchaseRequiredText, scanForMetadata } from '../src/lib/data/tagger'

describe('autoCategorize', () => {
  it('tags age-gated contests written as "18+" / "19+"', () => {
    expect(autoCategorize('Win a trip! Open to 18+ only', '').tags).toContain('18+')
    expect(autoCategorize('Beer fridge giveaway (19+)', '').tags).toContain('18+')
    expect(autoCategorize('Must be 21 years or older', '').tags).toContain('18+')
    expect(autoCategorize('Top 118 prizes', '').tags).not.toContain('18+')
  })

  it('flags Quebec exclusions, including accented and "excluding" wording', () => {
    const cases = [
      'Open to residents of Canada, excluding Québec',
      'Canada (excl. Quebec)',
      'Void in QC',
      'Rest of Canada only',
      'Contest [no qc] daily',
      'Quebec residents are not eligible',
      'Open to all Canadians except Quebec',
    ]
    for (const text of cases) {
      expect(autoCategorize(text, '').restrictions, text).toContain('no_quebec')
    }
    expect(autoCategorize('Open to residents of Quebec', '').restrictions).not.toContain('no_quebec')
  })

  it('bracketed and dollar-amount markers match', () => {
    expect(autoCategorize('[Daily] Win coffee', '').tags).toContain('Daily')
    expect(autoCategorize('Win $10,000 cash', '').tags).toContain('High Value')
    expect(autoCategorize('Grand prize: $25,000', '').tags).toContain('High Value')
    expect(autoCategorize('Enter [once] for a chance', '').tags).toContain('1 Single Entry')
  })

  it('does not treat an Instant Pot prize as an instant win', () => {
    expect(autoCategorize('Win an Instant Pot', '').tags).not.toContain('Instant Win')
    expect(autoCategorize('Instant Win Game — play daily', '').tags).toContain('Instant Win')
  })

  it('separates purchase-required from "no purchase necessary"', () => {
    expect(isPurchaseRequiredText('No purchase necessary. Enter online.')).toBe(false)
    expect(isPurchaseRequiredText('Buy any 2 products and upload your receipt')).toBe(true)
    const easy = autoCategorize('Win a $50 gift card', 'No purchase necessary')
    expect(easy.tags).toContain('⚡ Easy Entry')
  })
})

describe('scanForMetadata eligibility', () => {
  it.each([
    ['Open to legal residents of Canada', 'CA'],
    ['Open to all Canadians 18+', 'CA'],
    ['Open to residents of Ontario only', 'CA'],
    ['Legal residents of the 50 United States and DC', 'US'],
    ['U.S. residents only', 'US'],
    ['Open to residents of Canada and the US', 'NA'],
    ['Win a toaster', 'Unknown'],
  ])('%s → %s', (text, expected) => {
    expect(scanForMetadata(text, '').eligibility).toBe(expected)
  })
})
