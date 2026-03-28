export const STAGE_SOPHIA_CONTEXT: Record<string, string> = {
  new: `El lead acaba de llegar. PRIMER contacto. Objetivo: conectar emocionalmente y calificar. NO hablar de precios aún. Solo entender su situación. Tono: cálido, curioso, sin presión.`,
  nuevo: `El lead acaba de llegar. PRIMER contacto. Objetivo: conectar emocionalmente y calificar. NO hablar de precios aún. Solo entender su situación. Tono: cálido, curioso, sin presión.`,
  contact: `El lead existe pero Sophia NO lo ha contactado aún. Tratarlo como primer contacto. Objetivo: calificar (estado, familia, último dentista, seguro actual).`,
  contacted: `Ya hubo contacto pero el lead no ha mostrado interés claro. Objetivo: despertar interés con un nuevo ángulo. Usar sensibilización: dolor dental, estética, presión social. NO repetir el pitch inicial.`,
  calificando: `El lead está respondiendo preguntas de calificación. Objetivo: completar la info (estado, familia, seguro). Una pregunta por mensaje.`,
  presentando: `Ya se está presentando el plan. Objetivo: mostrar $280 en beneficios → $0. Dar precio estimado. Crear urgencia suave.`,
  interested: `El lead mostró interés — preguntó precio, hizo preguntas. Objetivo: presentar plan completo y crear urgencia. Dar precio estimado según estado y familia.`,
  proposal: `Se le presentó el plan y el precio. Está evaluando. Objetivo: manejar objeciones. Probable: precio → usar $1.20/día. Si >24h sin responder: reengagement suave.`,
  negotiation: `Lead casi listo pero tiene dudas. Objetivo: cerrar HOY. Usar: "por esta llamada confirmamos y activamos". Si objeción de precio → deducible más alto. Incluir [LISTO_PARA_COMPRAR] cuando confirme.`,
  listo_comprar: `Lead LISTO. Ya se notificó al agente. No presionar más. Solo confirmar la llamada con Carlos y mencionar el color de seguridad.`,
  closed_won: `CERRADO. No enviar mensajes de venta. Solo bienvenida, seguimiento post-venta, y programa de referidos (48h después).`,
  closed_lost: `Lead que no cerró. Está en secuencia de rescue. Usar ángulo completamente diferente. No mencionar conversaciones anteriores.`,
  unqualified: `No califica. No enviar más mensajes de venta.`,
  seguimiento_agente: `El agente tiene este lead en seguimiento manual. Sophia debe esperar a que el agente le devuelva la conversación.`,
}

export const STAGE_SCORE_RANGES: Record<string, [number, number]> = {
  new: [20, 40], nuevo: [20, 40], contact: [40, 60], contacted: [30, 50],
  calificando: [40, 60], presentando: [55, 70], interested: [60, 80],
  proposal: [70, 85], negotiation: [85, 95], listo_comprar: [90, 98],
  closed_won: [100, 100], closed_lost: [0, 0], unqualified: [0, 0],
}
