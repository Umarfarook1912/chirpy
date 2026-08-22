import { SyncService } from './SyncService';
import type { ExtensionMessage } from '../types/extension.types';

const syncService = new SyncService();

chrome.runtime.onInstalled.addListener(() => {
  console.warn('[CHIRPY] Extension installed');
});

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse): boolean => {
    switch (message.type) {
      case 'MEETING_STARTED':
        console.warn('[CHIRPY] Meeting started:', message.payload);
        sendResponse({ success: true });
        return false;

      case 'MEETING_ENDED':
        console.warn('[CHIRPY] Meeting ended:', message.payload);
        void syncService.processPendingItems();
        sendResponse({ success: true });
        return false;

      case 'SYNC_SESSION':
        void syncService.processPendingItems().then(() => {
          sendResponse({ success: true });
        });
        return true;

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
        return false;
    }
  },
);

chrome.alarms.create('chirpy-sync', { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'chirpy-sync') {
    void syncService.processPendingItems();
  }
});
