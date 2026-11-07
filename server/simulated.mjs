// Deterministic stand-ins for the local demo shop. Results carry the SIMULATED label.
// They are never used for a real site: a failed call must stay a visible failure.

export const isDemoUrl = (url) => /^https?:\/\/(localhost|127\.0\.0\.1)([:/]|$)/.test(url ?? '');

export function experimentMode(evidence, aiAvailable) {
  if (aiAvailable) return 'live';
  return evidence.every((item) => isDemoUrl(item.url)) ? 'simulated' : 'unavailable';
}

export function simulatedExperiment({ evidence, capabilities }) {
  const first = evidence[0];
  const claims = evidence.map((item) => ({
    text: `${item.rival}: "${item.after ?? item.before}".`,
    evidenceId: item.id,
  }));
  const shared = {
    guardrailMetric: 'Average order value',
    stopCondition: 'Stop if average order value falls by more than 10% after two full weeks.',
    claims,
  };

  if (first.type === 'bundle_sample') {
    return {
      ...shared,
      summary: 'Test a sample set for people who will not buy a full bottle without trying it.',
      hypothesis: 'If we offer a sample set on the page, more undecided visitors will place a first order.',
      requires: ['samples'],
      discountPct: 0,
      headline: 'Try it before you choose',
      body: 'A set of three 2 ml samples shows how the scent develops on your skin.',
      cta: 'Add the sample set',
      primaryMetric: 'Sample set add-to-cart rate',
    };
  }
  if (first.type === 'shipping' && capabilities.freeShipping) {
    return {
      ...shared,
      summary: 'Test showing the free shipping threshold next to the price.',
      hypothesis: 'If the threshold is visible next to the price, more visitors will complete their order.',
      requires: ['freeShipping'],
      discountPct: 0,
      headline: 'Free shipping',
      body: 'See the free shipping threshold before you add to cart.',
      cta: 'Add to cart',
      primaryMetric: 'Checkout completion rate',
    };
  }
  return {
    ...shared,
    summary: 'Test a clear message that answers the observed change.',
    hypothesis: 'If our offer is clearer on the page, more visitors will add the product to the cart.',
    requires: [],
    discountPct: 0,
    headline: 'Why choose this perfume',
    body: 'Say clearly what the customer gets and how returns work.',
    cta: 'Add to cart',
    primaryMetric: 'Add-to-cart rate',
  };
}
