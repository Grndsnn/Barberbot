import { db } from '../config/database.js';
import { barberService } from './barberService.js';
import { appointmentService } from './appointmentService.js';

export const gapDetectorService = {
  /**
   * Analiza la agenda de un barbero para una fecha específica
   * y detecta bloques libres (huecos) de al menos minDuration minutos.
   */
  detectGaps(barberId, targetDateStr = null, minDuration = 35) {
    const barber = barberService.getBarberById(barberId);
    if (!barber) return null;

    const availableSlots = appointmentService.getAvailableSlots(barberId, targetDateStr, minDuration);
    if (!availableSlots || availableSlots.length === 0) {
      return {
        barber,
        gaps: [],
        totalGaps: 0,
        potentialRevenue: 0,
        proposedStatus: null
      };
    }

    // Filtrar huecos que tengan sentido para publicar (ej. mañana o tarde)
    // Para la demo, tomamos hasta 3 huecos clave representativos
    const keyGaps = availableSlots.slice(0, 3);
    const standardPrice = 22000; // Corte base de $22.000 COP
    const potentialRevenue = keyGaps.length * standardPrice;

    // Generar copy de alto impacto para Estado de WhatsApp
    const timesFormatted = keyGaps.map(g => g.time || g.label).join(', ');
    const proposedCopy = `💈 *¡Últimos turnos disponibles hoy con ${barber.name.split(' ')[0]}!* ✂️🔥\n\n` +
      `Quedan libres: *${timesFormatted}*.\n` +
      `¡Escríbeme *'Quiero turno'* ya para apartar el tuyo antes de que se llenen! 📲⚡`;

    return {
      barber_id: barber.id,
      barber_name: barber.name,
      barber_phone: barber.phone,
      gaps: keyGaps,
      totalGaps: keyGaps.length,
      potentialRevenue,
      proposedCopy,
      status: 'pending_approval', // pending_approval | published | dismissed
      created_at: new Date().toISOString()
    };
  },

  /**
   * Escanea todos los barberos activos de la barbería
   */
  scanAllActiveBarbers(targetDateStr = null) {
    const barbers = barberService.getAllBarbers();
    const opportunities = [];

    for (const barber of barbers) {
      const analysis = this.detectGaps(barber.id, targetDateStr);
      if (analysis && analysis.totalGaps > 0) {
        opportunities.push(analysis);
      }
    }

    return opportunities;
  },

  /**
   * Procesa la autorización del barbero y publica en Estados de WhatsApp
   */
  authorizeAndPublishStatus(barberId, customCopy = null) {
    const analysis = this.detectGaps(barberId);
    if (!analysis) {
      throw new Error('Barbero no encontrado para publicar estado.');
    }

    const copyToPublish = customCopy || analysis.proposedCopy;
    const publicationRecord = {
      id: `status-pub-${Date.now()}`,
      barber_id: barberId,
      barber_name: analysis.barber_name,
      copy: copyToPublish,
      target: 'status@broadcast', // Formato estándar de Estados de WhatsApp
      published_at: new Date().toISOString(),
      status: 'published',
      estimated_reach: Math.floor(Math.random() * 400) + 450, // Entre 450 y 850 contactos
      responses_count: 0
    };

    // Registrar en memoria de base de datos
    db.whatsapp_statuses = db.whatsapp_statuses || [];
    db.whatsapp_statuses.unshift(publicationRecord);

    return publicationRecord;
  },

  /**
   * Obtiene el historial de estados de WhatsApp publicados
   */
  getPublishedStatuses() {
    return db.whatsapp_statuses || [];
  }
};
