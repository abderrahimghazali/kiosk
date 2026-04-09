export const CUSTOM_ID = {
  // Order wizard
  ORDER_START: 'order_start',
  ORDER_VARIANT: 'order_variant',
  ORDER_STEP_TEXT_BTN: 'order_step_text_btn',
  ORDER_STEP_TEXT_MODAL: 'order_step_text_modal',
  ORDER_STEP_SELECT: 'order_step_select',
  ORDER_PAY: 'order_pay',
  ORDER_CANCEL: 'order_cancel',
  // Admin actions
  ADMIN_ACCEPT: 'admin_accept',
  ADMIN_COMPLETE: 'admin_complete',
  ADMIN_CANCEL: 'admin_cancel',

  // Service builder
  SVC_ADD_VARIANT_BTN: 'svc_add_variant_btn',
  SVC_ADD_VARIANT_MODAL: 'svc_add_variant_modal',
  SVC_DONE_VARIANTS: 'svc_done_variants',
  SVC_ADD_TEXT_STEP_BTN: 'svc_add_text_step_btn',
  SVC_ADD_TEXT_STEP_MODAL: 'svc_add_text_step_modal',
  SVC_ADD_SELECT_STEP_BTN: 'svc_add_select_step_btn',
  SVC_ADD_SELECT_STEP_MODAL: 'svc_add_select_step_modal',
  SVC_SKIP_STEPS: 'svc_skip_steps',
  SVC_DONE_STEPS: 'svc_done_steps',
  SVC_ADD_SCREENSHOT_BTN: 'svc_add_screenshot_btn',
  SVC_ADD_SCREENSHOT_MODAL: 'svc_add_screenshot_modal',
  SVC_SKIP_SCREENSHOTS: 'svc_skip_screenshots',
  SVC_DONE_SCREENSHOTS: 'svc_done_screenshots',
  SVC_PUBLISH: 'svc_publish',
  SVC_SAVE_DRAFT: 'svc_save_draft',

  // Coupon (order wizard)
  ORDER_COUPON_BTN: 'order_coupon_btn',
  ORDER_COUPON_MODAL: 'order_coupon_modal',
  ORDER_REMOVE_COUPON: 'order_remove_coupon',

  // Staff application
  STAFF_APPLY_BTN: 'staff_apply_btn',
  STAFF_APPLY_MODAL: 'staff_apply_modal',
  STAFF_APP_ACCEPT: 'staff_app_accept',
  STAFF_APP_REJECT: 'staff_app_reject',
  STAFF_APP_ROLE_SELECT: 'staff_app_role_select',

  // Catalog
  CATALOG_CATEGORY: 'catalog_category',

  // Setup
  SETUP_MODAL: 'setup_modal',
} as const;

export const COLORS = {
  PRIMARY: 0x5865f2,
  SUCCESS: 0x57f287,
  WARNING: 0xfee75c,
  DANGER: 0xed4245,
  INFO: 0x5865f2,
  PAID: 0xfee75c,
  IN_PROGRESS: 0x3498db,
  COMPLETED: 0x57f287,
  CANCELLED: 0xed4245,
  REFUNDED: 0xed4245,
} as const;

export const LIMITS = {
  WIZARD_TTL_MS: 15 * 60 * 1000, // 15 minutes
  SERVICE_NAME_MAX: 100,
  SERVICE_DESC_MAX: 2000,
  MAX_VARIANTS: 10,
  MAX_STEPS: 10,
  MAX_SCREENSHOTS: 5,
} as const;

export const ORDER_STATUS = {
  PENDING_PAYMENT: 'pending_payment',
  PAID: 'paid',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];
