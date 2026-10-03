const fs = require('fs');
const path = require('path');

const enums = {
  RoleName: {
    ADMIN: 'ADMIN',
    FIELD_OFFICER: 'FIELD_OFFICER',
    COLLECTION_AGENT: 'COLLECTION_AGENT',
    ACCOUNTS: 'ACCOUNTS',
    VIEWER: 'VIEWER',
    BENEFICIARY: 'BENEFICIARY',
  },
  UserStatus: {
    ACTIVE: 'ACTIVE',
    LOCKED: 'LOCKED',
    DISABLED: 'DISABLED',
    ARCHIVED: 'ARCHIVED',
  },
  DeviceStatus: {
    ACTIVE: 'ACTIVE',
    REVOKED: 'REVOKED',
    BLOCKED: 'BLOCKED',
  },
  LocationDirection: {
    NORTH: 'NORTH',
    SOUTH: 'SOUTH',
    EAST: 'EAST',
    WEST: 'WEST',
  },
  BeneficiaryStatus: {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
  },
  LandStatus: {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
  },
  ProjectStatus: {
    PLANNING: 'PLANNING',
    ACTIVE: 'ACTIVE',
    SUSPENDED: 'SUSPENDED',
    COMPLETED: 'COMPLETED',
  },
  ApplicationStatus: {
    SUBMITTED: 'SUBMITTED',
    UNDER_REVIEW: 'UNDER_REVIEW',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
  },
  ApprovalStatus: {
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    CANCELLED: 'CANCELLED',
  },
  BillStatus: {
    PENDING: 'PENDING',
    PARTIALLY_PAID: 'PARTIALLY_PAID',
    PAID: 'PAID',
    CANCELLED: 'CANCELLED',
  },
  InstallmentStatus: {
    PENDING: 'PENDING',
    PARTIALLY_PAID: 'PARTIALLY_PAID',
    PAID: 'PAID',
    OVERDUE: 'OVERDUE',
    WAIVED: 'WAIVED',
    CANCELLED: 'CANCELLED',
  },
  PaymentMode: {
    CASH: 'CASH',
    BANK_TRANSFER: 'BANK_TRANSFER',
    UPI: 'UPI',
    CHEQUE: 'CHEQUE',
    DD: 'DD',
    ONLINE: 'ONLINE',
    OTHER: 'OTHER',
  },
  PaymentStatus: {
    COMPLETED: 'COMPLETED',
    REVERSED: 'REVERSED',
  },
  InfrastructureStatus: {
    PLANNED: 'PLANNED',
    UNDER_CONSTRUCTION: 'UNDER_CONSTRUCTION',
    COMPLETED: 'COMPLETED',
    COMMISSIONED: 'COMMISSIONED',
  },
  ExtensionStatus: {
    REQUESTED: 'REQUESTED',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    CANCELLED: 'CANCELLED',
  },
  AuditAction: {
    CREATE: 'CREATE',
    UPDATE: 'UPDATE',
    DELETE_VOID: 'DELETE_VOID',
    SUBMIT: 'SUBMIT',
    APPROVE: 'APPROVE',
    REJECT: 'REJECT',
    PARTIALLY_APPROVE: 'PARTIALLY_APPROVE',
    PAYMENT_RECORDED: 'PAYMENT_RECORDED',
    PAYMENT_REVERSED: 'PAYMENT_REVERSED',
    RATE_CHANGED: 'RATE_CHANGED',
    INSTALLMENT_SCHEDULE_CHANGED: 'INSTALLMENT_SCHEDULE_CHANGED',
    INFRASTRUCTURE_STATUS_CHANGED: 'INFRASTRUCTURE_STATUS_CHANGED',
    EXTENSION_APPROVED: 'EXTENSION_APPROVED',
    USAGE_RECORDED: 'USAGE_RECORDED',
    USAGE_UPDATED: 'USAGE_UPDATED',
    USAGE_VERIFIED: 'USAGE_VERIFIED',
    USAGE_CORRECTED: 'USAGE_CORRECTED',
    USAGE_VOIDED: 'USAGE_VOIDED',
    RUNNING_BILL_CREATED: 'RUNNING_BILL_CREATED',
    RUNNING_BILL_VOIDED: 'RUNNING_BILL_VOIDED',
    RUNNING_PAYMENT_RECORDED: 'RUNNING_PAYMENT_RECORDED',
    RUNNING_PAYMENT_REVERSED: 'RUNNING_PAYMENT_REVERSED',
    TARIFF_RESOLVED: 'TARIFF_RESOLVED',
    COMMISSIONING_CHANGED: 'COMMISSIONING_CHANGED',
    RUNNING_START_DATE_CHANGED: 'RUNNING_START_DATE_CHANGED',
    SYSTEM_CLOCK_ROLLBACK: 'SYSTEM_CLOCK_ROLLBACK',
  },
  BillingPeriodStatus: {
    UPCOMING: 'UPCOMING',
    OPEN: 'OPEN',
    CLOSED: 'CLOSED',
  },
  UsageEntryMode: {
    DIRECT: 'DIRECT',
    METER_READING: 'METER_READING',
  },
  WaterUsageStatus: {
    DRAFT: 'DRAFT',
    RECORDED: 'RECORDED',
    SUBMITTED: 'SUBMITTED',
    VERIFIED: 'VERIFIED',
    BILLED: 'BILLED',
    VOIDED: 'VOIDED',
    OVER_ALLOCATION: 'OVER_ALLOCATION',
    REQUIRES_REVIEW: 'REQUIRES_REVIEW',
  },
  DocumentCategory: {
    LAND_RECORD: 'LAND_RECORD',
    WATER_APPLICATION: 'WATER_APPLICATION',
    APPROVAL_LETTER: 'APPROVAL_LETTER',
    PAYMENT_RECEIPT: 'PAYMENT_RECEIPT',
    INFRASTRUCTURE_REPORT: 'INFRASTRUCTURE_REPORT',
    EXTENSION_REQUEST: 'EXTENSION_REQUEST',
    OTHER: 'OTHER',
  },
  LocationImportStatus: {
    UPLOADED: 'UPLOADED',
    VALIDATING: 'VALIDATING',
    VALIDATED: 'VALIDATED',
    IMPORTED: 'IMPORTED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
  },
};

const targetFiles = [
  path.join(__dirname, '..', 'node_modules', '.prisma', 'client', 'index.js'),
  path.join(__dirname, '..', 'node_modules', '@prisma', 'client', 'index.js'),
];

let enumCode = '\n// === WATER MANAGEMENT SYSTEM RUNTIME ENUMS FOR SQLITE ===\n';
for (const [enumName, enumValues] of Object.entries(enums)) {
  enumCode += `exports.${enumName} = ${JSON.stringify(enumValues, null, 2)};\n`;
  enumCode += `exports.$Enums.${enumName} = exports.${enumName};\n`;
}

targetFiles.forEach((file) => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    if (!content.includes('WATER MANAGEMENT SYSTEM RUNTIME ENUMS')) {
      content += enumCode;
      fs.writeFileSync(file, content, 'utf8');
      console.log(`✓ Patched runtime enums into: ${file}`);
    }
  }
});
