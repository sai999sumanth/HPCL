
import enum



class BusinessUnit(str, enum.Enum):
    RO = 'RO'
    TAS = 'TAS'
    LPG = 'LPG'
    RDI = 'RDI'
    CP = 'CP'







class AlertStatus(str, enum.Enum):
    Open = 'Open'
    Close = 'Close'
    InProgress = 'InProgress'
    Cancel = 'Cancel'
    OnHold = 'OnHold'




