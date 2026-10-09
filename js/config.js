const localApiBaseUrl = window.location.protocol === 'file:'
  || ['localhost', '127.0.0.1'].includes(window.location.hostname)
  ? 'http://localhost:3000/api'
  : '/api';

window.APP_CONFIG = {
  supabase: {
    url: window.SUPABASE_URL || '',
    anonKey: window.SUPABASE_ANON_KEY || ''
  },
  api: {
    baseUrl: window.API_BASE_URL || localApiBaseUrl
  },
  whatsapp: {
    number: window.WHATSAPP_NUMBER || '23278952429'
  },
  monime: {
    recipient: window.MONIME_RECIPIENT || '+23278952429'
  },
  customization: {
    price: 400,
    maxNameLength: 12,
    maxNumberLength: 2
  },
  pagination: {
    itemsPerPage: 12
  },
  delivery: {
    pickup: { cost: 0, estimatedDays: 'Same day - 2 days', address: '30 Mountain Cut, Freetown' },
    standard: { cost: 50, estimatedDays: 'Delivery in 24 hours' }
  }
};

const supabaseClient = null;

const API_BASE = window.APP_CONFIG.api.baseUrl;
const WHATSAPP_NUMBER = window.APP_CONFIG.whatsapp.number;
const MONIME_RECIPIENT = window.APP_CONFIG.monime.recipient;
const CUSTOM_NAME_MAX_LENGTH = window.APP_CONFIG.customization.maxNameLength;
const CUSTOM_KIT_PRICE = window.APP_CONFIG.customization.price;
const ITEMS_PER_PAGE = window.APP_CONFIG.pagination.itemsPerPage;
const DELIVERY_OPTIONS = window.APP_CONFIG.delivery;
