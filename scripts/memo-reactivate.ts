// scripts/memo-reactivate.ts
const twilio = require('twilio')
require('dotenv').config({ path: '.env.local' })

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

client.messages.create({
  from: 'whatsapp:+17722772510',
  to:   'whatsapp:+19547293836',
  body: `Hola Memo 😊 Soy Sophia de SeguriSSimo.

Me doy cuenta que cuando me escribiste querías información sobre el IUL — y yo te respondí hablando de dental. Eso estuvo mal de mi parte y te pido disculpas.

Tienes toda la razón en no estar interesado en lo que te ofrecí, porque no era lo que buscabas.

Si aún tienes interés en el IUL, con gusto te explico cómo funciona — especialmente dos cosas que lo hacen único:

🔒 Tu dinero nunca pierde valor, aunque el mercado caiga
💰 El retiro es 100% libre de impuestos

¿Me das la oportunidad de explicarte bien esta vez?`
}).then((msg: any) => console.log('✅ Enviado:', msg.sid))
  .catch(console.error)
