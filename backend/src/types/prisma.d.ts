import * as CommonEnums from '../modules/common/enums';

declare module '@prisma/client' {
  export import RoleName = CommonEnums.RoleName;
  export import LocationDirection = CommonEnums.LocationDirection;
  export import BeneficiaryStatus = CommonEnums.BeneficiaryStatus;
  export import LandStatus = CommonEnums.LandStatus;
  export import ProjectStatus = CommonEnums.ProjectStatus;
  export import ApplicationStatus = CommonEnums.ApplicationStatus;
  export import ApprovalStatus = CommonEnums.ApprovalStatus;
  export import BillStatus = CommonEnums.BillStatus;
  export import InstallmentStatus = CommonEnums.InstallmentStatus;
  export import PaymentMode = CommonEnums.PaymentMode;
  export import PaymentStatus = CommonEnums.PaymentStatus;
  export import InfrastructureStatus = CommonEnums.InfrastructureStatus;
  export import ExtensionStatus = CommonEnums.ExtensionStatus;
  export import AuditAction = CommonEnums.AuditAction;
  export import DocumentCategory = CommonEnums.DocumentCategory;
  export import LocationImportStatus = CommonEnums.LocationImportStatus;
}
