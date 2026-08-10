
import enum



class BusinessUnit(str, enum.Enum):
    TAS = 'TAS'
    LPG = 'LPG'
    RO = 'RO'
    RDI = 'RDI'
    CP = 'CP'
    CDCMS = 'CDCMS'
    ALL = 'ALL'







class Status(str, enum.Enum):
    Open = 'Open'
    Close = 'Close'
    Pending = 'Pending'







class State(str, enum.Enum):
    Open = 'Open'
    Reassigned = 'Reassigned'
    Escalated = 'Escalated'
    UpdatedByInitiator = 'Updated By Initiator'
    ReturnedByOcc = 'Returned By Occ'
    ReviewedByOcc = 'Reviewed By Occ'







class Severity(str, enum.Enum):
    Critical = 'Critical'
    High = 'High'
    Medium = 'Medium'
    Low = 'Low'







class Assignee(str, enum.Enum):
    NovexSupport = 'NovexSupport'
    TechSupport = 'TechSupport'







class TicketType(str, enum.Enum):
    Open = 'TicketRaised'
    Reassigned = 'TicketReassigned'
    Escalated = 'TicketEscalated'
    UpdatedByInitiator = 'TicketOnCompleted'
    ReturnedByOcc = 'TicketReOpen'
    ReviewedByOcc = 'TicketResolved'







class ContextType(str, enum.Enum):
    Hpcl = 'Hpcl'
    Recon = 'Recon'
    DataValidation = 'DataValidation'




