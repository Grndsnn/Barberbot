import { gapDetectorService } from '../services/gapDetectorService.js';
import { db } from '../config/database.js';

export const marketingController = {
  /**
   * Obtiene el análisis de huecos libres para hoy y la propuesta de Estado
   */
  getGapsAnalysis(req, res) {
    try {
      const { barberId } = req.query;
      if (barberId) {
        const result = gapDetectorService.detectGaps(barberId);
        return res.json({ success: true, data: result });
      }

      const opportunities = gapDetectorService.scanAllActiveBarbers();
      return res.json({
        success: true,
        data: opportunities,
        total_opportunities: opportunities.length,
        summary: {
          total_revenue_opportunity: opportunities.reduce((acc, o) => acc + o.potentialRevenue, 0),
          total_free_slots: opportunities.reduce((acc, o) => acc + o.totalGaps, 0)
        }
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * Autoriza y publica el Estado en WhatsApp (Human-in-the-Loop)
   */
  authorizeStatus(req, res) {
    try {
      const { barber_id, custom_copy } = req.body;
      if (!barber_id) {
        return res.status(400).json({ success: false, error: 'barber_id es requerido.' });
      }

      const published = gapDetectorService.authorizeAndPublishStatus(barber_id, custom_copy);

      return res.json({
        success: true,
        message: '¡Estado de WhatsApp publicado exitosamente a todos los contactos!',
        data: published
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * Historial de estados publicados
   */
  getPublishedStatuses(req, res) {
    const statuses = gapDetectorService.getPublishedStatuses();
    return res.json({ success: true, data: statuses });
  },

  /**
   * Estado de conexión del dispositivo WhatsApp (QR Pairing)
   */
  getDeviceStatus(req, res) {
    const device = db.whatsapp_device || {
      connected: false,
      phone: null,
      barber_name: null,
      battery: null,
      status_broadcast_enabled: false
    };

    // QR de demo en base64 SVG / DataURI estándar
    const qrData = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="white"/><rect x="10" y="10" width="30" height="30" fill="black"/><rect x="60" y="10" width="30" height="30" fill="black"/><rect x="10" y="60" width="30" height="30" fill="black"/><rect x="20" y="20" width="10" height="10" fill="white"/><rect x="70" y="20" width="10" height="10" fill="white"/><rect x="20" y="70" width="10" height="10" fill="white"/><rect x="45" y="45" width="10" height="10" fill="black"/><rect x="60" y="60" width="15" height="15" fill="black"/><rect x="45" y="15" width="10" height="10" fill="black"/><rect x="15" y="45" width="10" height="10" fill="black"/></svg>';

    return res.json({
      success: true,
      data: {
        ...device,
        qr_code: qrData
      }
    });
  },

  /**
   * Alternar estado de conexión del teléfono (Conectar / Desconectar)
   */
  toggleDeviceConnection(req, res) {
    const { connect, phone, barber_name } = req.body;
    db.whatsapp_device = db.whatsapp_device || {};

    if (connect === false) {
      db.whatsapp_device.connected = false;
      return res.json({ success: true, message: 'Dispositivo desconectado.', data: db.whatsapp_device });
    }

    db.whatsapp_device = {
      connected: true,
      phone: phone || '+573001234567',
      barber_name: barber_name || 'Toño El Máster',
      battery: 95,
      pushname: 'Barbería El Máster',
      status_broadcast_enabled: true,
      paired_at: new Date().toISOString()
    };

    return res.json({ success: true, message: 'Dispositivo vinculado exitosamente.', data: db.whatsapp_device });
  }
};
