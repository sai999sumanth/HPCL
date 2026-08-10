
import enum



class BusinessUnit(str, enum.Enum):
    RO = 'RO'
    TAS = 'TAS'
    LPG = 'LPG'
    RDI = 'RDI'
    CP = 'CP'
    CDCMS = 'CDCMS'
    ALL = 'ALL'
    DS = 'DS'







class VtsLive(str, enum.Enum):
    TripOngoing = 'Live'
    TripCompleted = 'Closed'







class BlockStatus(str, enum.Enum):
    Blocked = 'Blocked'
    UnBlocked = 'UnBlocked'
    WaitingForBlockAck = 'WaitingForBlockAck'
    WaitingForUnBlockAck = 'WaitingForUnBlockAck'
    OnGoingTrip = 'OnGoingTrip'







class DeviceType(str, enum.Enum):
    Tank = 'Tank'
    DU = 'DU'
    Pump = 'Pump'
    Nozzle = 'Nozzle'
    ATG = 'ATG'







class LoginStatus(str, enum.Enum):
    login = 'Logged In'
    logout = 'Logged Out'







class MakerChecker(str, enum.Enum):
    MAKER = 'maker'
    CHECKER = 'checker'







class NotificationLevel(str, enum.Enum):
    InitialNotification = 'InitialNotification'
    InitialEscalation = 'InitialEscalation'







class AlertStatus(str, enum.Enum):
    Open = 'Open'
    Close = 'Close'
    InProgress = 'InProgress'
    Cancel = 'Cancel'
    OnHold = 'OnHold'
    Resolved = 'Resolved'







class AlertState(str, enum.Enum):
    InProgress = 'InProgress'
    Notified = 'Notified'
    Escalated = 'Escalated'
    Resolved = 'Resolved'







class Severity(str, enum.Enum):
    Low = 'Low'
    Medium = 'Medium'
    High = 'High'
    Critical = 'Critical'







class LocationHealth(str, enum.Enum):
    Normal = 'Normal'
    Failed = 'Failed'
    Deactivated = 'Deactivated'







class AlertActionType(str, enum.Enum):
    Justification = 'Justification'
    AcceptClose = 'AcceptClose'
    FalseAlert = 'FalseAlert'
    InvalidAlert = 'InvalidAlert'
    ValidAlert = 'ValidAlert'
    Rejected = 'Rejected'
    Approved = 'Approved'
    Override = 'Override'
    interLockOk = 'interLockOk'
    Message = 'Message'
    excApprovalTimeExp = 'excApprovalTimeExp'
    Raised = 'Raised'
    Cancelled = 'Cancelled'
    Allocated = 'Allocated'
    SentToSap = 'SentToSap'
    OrderPlaced = 'OrderPlaced'
    Created = 'Created'
    R1Swipe = 'R1Swipe'
    R2Swipe = 'R2Swipe'
    R3Swipe = 'R3Swipe'
    VTS = 'VTS'
    Delivered = 'Delivered'
    Tripped = 'Tripped'
    InterlockCreated = 'InterlockCreated'
    InterlockCleared = 'InterlockCleared'
    InterlockNotCleared = 'InterlockNotCleared'
    UnderMaintenance = 'UnderMaintenance'
    RevocationApproved = 'RevocationApproved'
    ExceptionApproved = 'ExceptionApproved'
    Active = 'Active'
    Notified = 'Notified'
    Escalated = 'Escalated'
    Resolved = 'Resolved'
    Blocked = 'Blocked'
    UnBlocked = 'UnBlocked'
    Request = 'Request'
    Interrupt = 'Interrupt'
    BayReAssigned = 'BayReAssigned'
    Effect = 'Effect'
    Cause = 'Cause'
    ESDFailure = 'ESDFailure'
    Maintenance = 'Maintenance'
    TicketRaised = 'TicketRaised'
    TicketReassigned = 'TicketReassigned'
    TicketInProgress = 'TicketInProgress'
    TicketCancelled = 'TicketCancelled'
    TicketResolved = 'TicketResolved'
    TicketOnHold = 'TicketOnHold'
    TicketReOpen = 'TicketReOpen'
    TicketOnCompleted = 'TicketOnCompleted'
    SendItBack = 'SendItBack'
    FalseViolation = 'FalseViolation'
    AcceptViolation = 'AcceptViolation'
    BlockFailed = 'BlockFailed'
    UnblockFailed = 'UnblockFailed'
    OngoingTrip = 'OngoingTrip'
    BlockInitiated = 'BlockInitiated'
    UnBlockInitiated = 'UnBlockInitiated'
    OccBlockingRemarks = 'OccBlockingRemarks'
    OccUnblockingRemarks = 'OccUnblockingRemarks'
    Remarks = 'Remarks'
    Offline = 'Offline'







class IndentStatus(str, enum.Enum):
    Pending = 'Pending'
    IndentNotRaised = 'IndentNotRaised'
    IndentRaised = 'IndentRaised'
    IndentOnHold = 'IndentOnHold'
    IndentOnHoldReleased = 'IndentOnHoldReleased'
    Cancelled = 'Cancelled'
    TruckAllocated = 'TruckAllocated'
    TruckNotAllocated = 'TruckNotAllocated'
    Transit = 'Transit'
    InvoiceCreated = 'InvoiceCreated'
    ValidIndent = 'ValidIndent'
    SentToSAP = 'SentToSAP'
    SalesOrderPlaced = 'SalesOrderPlaced'
    Completed = 'Completed'
    R1Swipe = 'R1Swipe'
    R2Swipe = 'R2Swipe'
    R3Swipe = 'R3Swipe'
    VTS = 'VTS'
    Delivered = 'Delivered'
    TempClosed = 'TempClosed'
    ProductLowLevel = 'ProductLowLevel'
    OfflineOrFalseAlarm = 'OfflineOrFalseAlarm'
    NotAvailable = 'NotAvailable'







class AlertActionState(str, enum.Enum):
    CreatedAt = 'CreatedAt'
    ClosedAt = 'ClosedAt'
    BlockInitiated = 'BlockInitiated'
    UnBlockInitiated = 'UnBlockInitiated'
    Blocked = 'Blocked'
    UnBlocked = 'Unblocked'
    BlockAck = 'BlockAck'
    UnblockAck = 'UnblockAck'







class TasLogAction(str, enum.Enum):
    GantryShutdown = 'GantryShutdown'
    ESDShutdown = 'ESDShutdown'
    SignalClearOff = 'SignalClearOff'







class TasLogSection(str, enum.Enum):
    Gantry = 'Gantry'
    ESD = 'ESD'




