/**
 * Stripe Price IDs for SophiaOS Products
 *
 * Estos IDs se generan al crear los productos en Stripe Dashboard
 * o usando la Stripe API. Actualiza estos valores con los IDs reales.
 */

export const STRIPE_PRICES = {
  // SophiaOS Starter: $197/mes → $1,764/año
  starter: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER_MONTHLY || '',
    annual: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER_ANNUAL || '',
  },

  // SophiaOS Pro: $397/mes → $3,564/año
  pro: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY || '',
    annual: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL || '',
  },

  // SophiaOS Agency: $697/mes → $1,164/año (precio de lanzamiento)
  agency: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_AGENCY_MONTHLY || '',
    annual: process.env.NEXT_PUBLIC_STRIPE_PRICE_AGENCY_ANNUAL || '',
  },
}

/**
 * Mapeo de planes a precios para checkout
 * Uso: PLAN_PRICES[plan][billing] = priceId
 */
export const PLAN_PRICES: Record<string, Record<string, string>> = {
  starter: STRIPE_PRICES.starter,
  pro: STRIPE_PRICES.pro,
  agency: STRIPE_PRICES.agency,
}

/**
 * Información de productos para mostrar en el dashboard/pricing page
 */
export const PRODUCTS = {
  starter: {
    id: process.env.NEXT_PUBLIC_STRIPE_PRODUCT_STARTER || '',
    name: 'SophiaOS Starter',
    description: 'Para agentes individuales',
    monthlyPrice: 197,
    annualPrice: 1764,
    features: [
      'Sophia AI WhatsApp Bot',
      'Hasta 100 leads/mes',
      'Análisis básico de campaña',
      'Email support',
    ],
  },
  pro: {
    id: process.env.NEXT_PUBLIC_STRIPE_PRODUCT_PRO || '',
    name: 'SophiaOS Pro',
    description: 'Para agentes activos',
    monthlyPrice: 397,
    annualPrice: 3564,
    features: [
      'Sophia AI WhatsApp Bot',
      'Hasta 500 leads/mes',
      'Análisis avanzado de campaña',
      'Growth prediction',
      'PDF export',
      'Priority support',
    ],
  },
  agency: {
    id: process.env.NEXT_PUBLIC_STRIPE_PRODUCT_AGENCY || '',
    name: 'SophiaOS Agency',
    description: 'Para múltiples agentes y equipos',
    monthlyPrice: 697,
    annualPrice: 1164, // Precio de lanzamiento
    features: [
      'Sophia AI WhatsApp Bot (sin límite)',
      'Unlimited leads',
      'Team management',
      'Advanced analytics',
      'Growth prediction',
      'PDF export',
      'Custom integrations',
      '24/7 dedicated support',
    ],
  },
}
