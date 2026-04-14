/**
 * Setup Stripe Products & Prices
 * Run this ONCE to create products and generate Price IDs
 *
 * Usage:
 *   npx ts-node scripts/setup-stripe-products.ts
 *
 * Copy the output and add to .env.local:
 *   NEXT_PUBLIC_STRIPE_PRICE_STARTER_MONTHLY=price_xxx
 *   NEXT_PUBLIC_STRIPE_PRICE_STARTER_ANNUAL=price_xxx
 *   ...etc
 */

import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

async function setupProducts() {
  console.log('🚀 Creating Stripe products and prices...\n')

  try {
    // Starter
    console.log('📦 Creating Starter product...')
    const starter = await stripe.products.create({ name: 'SophiaOS Starter' })
    const starterMonthly = await stripe.prices.create({
      product: starter.id,
      unit_amount: 19700,
      currency: 'usd',
      recurring: { interval: 'month' },
    })
    const starterAnnual = await stripe.prices.create({
      product: starter.id,
      unit_amount: 176400,
      currency: 'usd',
      recurring: { interval: 'year' },
    })

    // Pro
    console.log('📦 Creating Pro product...')
    const pro = await stripe.products.create({ name: 'SophiaOS Pro' })
    const proMonthly = await stripe.prices.create({
      product: pro.id,
      unit_amount: 39700,
      currency: 'usd',
      recurring: { interval: 'month' },
    })
    const proAnnual = await stripe.prices.create({
      product: pro.id,
      unit_amount: 356400,
      currency: 'usd',
      recurring: { interval: 'year' },
    })

    // Agency
    console.log('📦 Creating Agency product...')
    const agency = await stripe.products.create({ name: 'SophiaOS Agency' })
    const agencyMonthly = await stripe.prices.create({
      product: agency.id,
      unit_amount: 69700,
      currency: 'usd',
      recurring: { interval: 'month' },
    })
    const agencyAnnual = await stripe.prices.create({
      product: agency.id,
      unit_amount: 116400,
      currency: 'usd',
      recurring: { interval: 'year' },
    })

    console.log('\n✅ All products created!\n')
    console.log('Add these to your .env.local:\n')

    const output = {
      NEXT_PUBLIC_STRIPE_PRICE_STARTER_MONTHLY: starterMonthly.id,
      NEXT_PUBLIC_STRIPE_PRICE_STARTER_ANNUAL: starterAnnual.id,
      NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY: proMonthly.id,
      NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL: proAnnual.id,
      NEXT_PUBLIC_STRIPE_PRICE_AGENCY_MONTHLY: agencyMonthly.id,
      NEXT_PUBLIC_STRIPE_PRICE_AGENCY_ANNUAL: agencyAnnual.id,
      NEXT_PUBLIC_STRIPE_PRODUCT_STARTER: starter.id,
      NEXT_PUBLIC_STRIPE_PRODUCT_PRO: pro.id,
      NEXT_PUBLIC_STRIPE_PRODUCT_AGENCY: agency.id,
    }

    Object.entries(output).forEach(([key, value]) => {
      console.log(`${key}=${value}`)
    })

    console.log('\n✨ Done! Copy the above to .env.local')
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

setupProducts()
