-- Document that client phones may be El Salvador (503) or United States (1).
COMMENT ON COLUMN public.clients.phone_number IS
  'WhatsApp/phone digits with country calling code, no leading +. El Salvador: 503XXXXXXXX. United States: 1XXXXXXXXXX.';
