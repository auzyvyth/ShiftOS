ALTER TABLE leads ADD COLUMN IF NOT EXISTS buyer_state text;
ALTER TABLE whatsapp_enquiries ADD COLUMN IF NOT EXISTS buyer_state text;
