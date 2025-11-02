class EventsService {
  emit(event: string, payload: any) {
    // Minimal emit stub for now. Later we'll replace with a proper Socket.IO Gateway.
    // Keep this lightweight so tests and early runtime calls don't fail.
    // You can extend this to integrate with Nest's Websockets gateway.
     
    console.log('[EventsService] emit', event, payload ? (payload && payload.id ? payload.id : '') : '');
    return true;
  }
}

const events = new EventsService();

// Support CommonJS require('../../websockets/events.service') used in some services
module.exports = events;

export default events;
