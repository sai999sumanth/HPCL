
import enum



class CloudProviders(str, enum.Enum):
    AWS = 'AWS'
    Azure = 'Azure'
    GCP = 'GCP'
    OCI = 'OCI'







class Types(str, enum.Enum):
    Manual = 'Manual'
    Query = 'Query'
    AIText = 'AIText'







class DashboardStatus(str, enum.Enum):
    Draft = 'Draft'
    Published = 'Published'
    Completed = 'Completed'







class panel_status(str, enum.Enum):
    Pending = 'Pending'
    Completed = 'Completed'




