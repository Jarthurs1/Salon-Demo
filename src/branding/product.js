/**
 * Product-level branding for the SaaS platform (not a salon business name).
 * Re-exports the reminders copy so Lambda packaging stays self-contained.
 */

export {
  PRODUCT_NAME,
  PRODUCT_SHORT_NAME,
  PRODUCT_TAGLINE,
  PRODUCT_DESCRIPTION,
  UNNAMED_SALON_FALLBACK,
  UNNAMED_STYLIST_FALLBACK,
} from '../reminders/productName.js'
